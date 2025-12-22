import React, { useRef, useEffect, useState } from 'react';
import { Message, Agent } from '../types';
import { User, Sparkles, ArrowUp, Paperclip, ChevronDown, Check, File as FileIcon, X, UploadCloud, PlusCircle, Users, Trash2 } from 'lucide-react';
import { parse } from 'marked';
import { generateGUID } from '../utils';

interface ChatPanelProps {
    messages: Message[];
    onSendMessage: (content: string, attachments: AttachmentFile[]) => void;
    isTyping: boolean;
    agents: Agent[];
    mcpConnections?: Record<number, any>;
    onShowComponents: () => void;
    onAddToCanvas: (message: Message) => void;
    onCloseMobile?: () => void;
    onDeleteAttachment: (messageId: string, attachmentId: string) => void;
}

export interface AttachmentFile {
    file: File;
    id: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isTyping, agents, mcpConnections = {}, onShowComponents, onAddToCanvas, onCloseMobile, onDeleteAttachment }) => {
    const [input, setInput] = useState('');
    const [showAgents, setShowAgents] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<AttachmentFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [attachmentToDelete, setAttachmentToDelete] = useState<{ messageId: string, attachmentId: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    useEffect(() => {
        console.log('Current messages:', messages);
    }, [messages]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowAgents(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if ((input.trim() || selectedFiles.length > 0) && !isTyping) {
            onSendMessage(input, selectedFiles);
            setInput('');
            setSelectedFiles([]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files).map(file => ({
                file,
                id: generateGUID()
            }));
            setSelectedFiles(prev => [...prev, ...newFiles]);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleManageComponents = () => {
        setShowAgents(false);
        onShowComponents();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) {
            return;
        }
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files).map(file => ({
                file,
                id: generateGUID()
            }));
            setSelectedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const activeAgentsCount = agents.filter(a => a.status === 'Active').length;

    return (
        <div
            className="h-full flex flex-col bg-gray-50 relative group w-full"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 bg-gray-900/5 border-2 border-dashed border-gray-900/20 z-50 flex items-center justify-center backdrop-blur-[1px] m-2 rounded-xl pointer-events-none animate-in fade-in duration-200">
                    <div className="bg-white px-8 py-6 rounded-xl shadow-lg flex flex-col items-center animate-bounce">
                        <UploadCloud size={48} className="text-gray-900 mb-3" />
                        <p className="text-lg font-semibold text-gray-900">Drop files to attach</p>
                    </div>
                </div>
            )}
            <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 bg-white shrink-0 z-10">
                <div className="flex items-center space-x-2">
                    {onCloseMobile && (
                        <button onClick={onCloseMobile} className="md:hidden p-2 -ml-2 mr-1 text-gray-600 hover:bg-gray-100 rounded-full">
                            <ChevronDown size={20} className="rotate-90" />
                        </button>
                    )}

                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowAgents(!showAgents)}
                            className="flex items-center space-x-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 px-2 py-1.5 -ml-2 rounded-md transition-colors group"
                        >
                            <span>Your Assistant</span>
                            <span className="flex items-center justify-center w-5 h-5 bg-gray-100 rounded-full text-[10px] text-gray-500 group-hover:bg-gray-200">
                                {activeAgentsCount}
                            </span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${showAgents ? 'rotate-180' : ''}`} />
                        </button>

                        {showAgents && (
                            <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                                <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Tools</p>
                                </div>
                                <div className="p-2 max-h-[300px] overflow-y-auto">
                                    {agents.map(agent => (
                                        <div key={agent.id} className="flex items-start space-x-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-default">
                                            <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 mt-4 ${agent.status === 'Active' ? 'bg-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.2)]' : 'bg-gray-300'}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className={`text-sm font-medium ${agent.status === 'Active' ? 'text-gray-900' : 'text-gray-500'}`}>
                                                        {agent.name}
                                                    </p>
                                                    {agent.status === 'Active' && <Check size={12} className="text-green-600" />}
                                                </div>
                                                <p className="text-xs text-gray-500 truncate mt-0.5">{agent.description}</p>
                                                {agent.tool === 'mcp' && agent.status === 'Active' && mcpConnections[agent.id]?.tools && (
                                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                                        {mcpConnections[agent.id].tools.map((tool: any) => {
                                                            const isDisabled = agent.disabledTools?.includes(tool.name);
                                                            if (isDisabled) return null;
                                                            return (
                                                                <span key={tool.name} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[8px] font-bold uppercase tracking-tight">
                                                                    {tool.name}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-3 py-2 border-t border-gray-50 bg-gray-50 text-center">
                                    <button
                                        onClick={handleManageComponents}
                                        className="text-xs font-medium text-gray-600 hover:text-gray-900 w-full py-1"
                                    >
                                        Manage Components
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {onCloseMobile && (
                    <button onClick={onCloseMobile} className="md:hidden p-2 text-gray-400 hover:text-gray-900">
                        <X size={20} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-3 group`}>
                            <div className={`
				w-8 h-8 rounded-full flex items-center justify-center shrink-0 border
				${msg.role === 'user'
                                    ? 'bg-white border-gray-200'
                                    : 'bg-gray-900 border-gray-900 text-white'}
			  `}>
                                {msg.role === 'user' ? <User size={14} className="text-gray-600" /> : <Sparkles size={14} />}
                            </div>

                            <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className={`flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full max-w-sm`}>
                                        {msg.attachments.map((att, idx) => (
                                            <div key={idx} className="p-3 rounded-lg text-sm border flex items-center space-x-3 w-full bg-white border-gray-200 group/attachment relative">
                                                <div className="p-2 bg-gray-100 rounded-md">
                                                    <FileIcon size={16} className="text-gray-600" />
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{att.name}</p>
                                                    <p className="text-xs text-gray-500 uppercase">{att.type.split('/')[1] || 'FILE'}</p>
                                                </div>
                                                <button
                                                    onClick={() => setAttachmentToDelete({ messageId: msg.id, attachmentId: att.id })}
                                                    className="opacity-0 group-hover/attachment:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all absolute right-2 bg-white shadow-sm"
                                                    title="Delete attachment"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {msg.content && (
                                    <div className="relative group/bubble flex-1 min-w-0 w-full">
                                        <div className={`
                                            p-4 rounded-lg text-sm leading-relaxed shadow-sm border text-left
                                            ${msg.role === 'user'
                                                ? 'bg-white border-gray-200 text-gray-900'
                                                : 'bg-white border-gray-200 text-gray-800'}
                                            w-full overflow-hidden
                                          `}>
                                            {msg.canvasBlockData && msg.canvasBlockData.sourceLabel && (
                                                <div className="mb-2 pb-2 border-b border-gray-100 flex items-center space-x-1.5">
                                                    <div className="p-0.5 bg-gray-100 rounded-full">
                                                        <Users size={10} className="text-gray-600" />
                                                    </div>
                                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                                        Generated Source: {msg.canvasBlockData.sourceLabel}
                                                    </span>
                                                </div>
                                            )}

                                            <div
                                                className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-p:text-gray-900' : 'prose-p:text-gray-800'}`}
                                                dangerouslySetInnerHTML={{ __html: parse(msg.content) as string }}
                                            />

                                            {msg.canvasBlockData && msg.canvasBlockData.content && (
                                                <div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in duration-300 max-w-full overflow-hidden">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                                            <Sparkles size={10} className="mr-1" />
                                                            {msg.canvasBlockData.title || 'Tool Result'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 italic">
                                                            {msg.canvasBlockData.view}
                                                        </span>
                                                    </div>
                                                    <div className={`
                                                        p-3 rounded-md border border-gray-100 bg-gray-50/50 overflow-x-auto custom-scrollbar w-full
                                                        ${msg.canvasBlockData.view === 'code' ? 'font-mono text-xs text-left' : 'prose prose-sm max-w-none break-words text-left'}
                                                    `}>
                                                        {msg.canvasBlockData.view === 'code' ? (
                                                            <pre className="whitespace-pre overflow-x-auto max-w-full">
                                                                <code>{msg.canvasBlockData.content}</code>
                                                            </pre>
                                                        ) : (
                                                            <div dangerouslySetInnerHTML={{ __html: parse(msg.canvasBlockData.content) as string }} />
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-2 flex items-center justify-end">
                                                <span className="text-[10px] text-gray-400">
                                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>

                                        {msg.role === 'model' && (
                                            <button
                                                onClick={() => onAddToCanvas(msg)}
                                                className="absolute -right-8 top-2 p-1.5 bg-white rounded-full border border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-300 shadow-sm opacity-100 md:opacity-0 group-hover/bubble:opacity-100 transition-all transform md:translate-x-[-5px] group-hover/bubble:translate-x-0 z-10"
                                                title="Add to Document"
                                            >
                                                <PlusCircle size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {msg.rawToolOutput && (
                                    <div className="relative group/jsonbox flex-1 min-w-0 w-full animate-in slide-in-from-top-2 duration-300">
                                        <div className="p-4 rounded-lg text-sm bg-white border border-gray-200 shadow-sm w-full overflow-hidden">
                                            <details className="group/json w-full max-w-full">
                                                <summary className="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-900 flex items-center select-none py-1.5 px-2 rounded-md hover:bg-gray-50 transition-all flex w-full mb-1">
                                                    <div className="p-0.5 mr-1.5 group-open/json:rotate-180 transition-transform duration-300">
                                                        <ChevronDown size={10} />
                                                    </div>
                                                    <span>Raw Tool Output (JSON)</span>
                                                </summary>
                                                <div className="mt-1 p-0 rounded-lg border border-gray-100 bg-gray-50/30 overflow-hidden w-full max-w-full animate-in slide-in-from-top-1 duration-200">
                                                    <div className="relative group/jsoncode p-3">
                                                        <pre className="whitespace-pre overflow-x-auto text-[10px] font-mono custom-scrollbar max-h-60 text-gray-600 leading-tight">
                                                            <code>{JSON.stringify(msg.rawToolOutput, null, 2)}</code>
                                                        </pre>
                                                        <div className="mt-3 flex items-center justify-end border-t border-gray-100 pt-2 bg-white/50 -mx-3 -mb-3 px-3 py-2">
                                                            <span className="text-[9px] text-gray-400 font-medium">application/json</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </details>
                                        </div>

                                        <button
                                            onClick={() => onAddToCanvas({
                                                ...msg,
                                                content: JSON.stringify(msg.rawToolOutput, null, 2),
                                                canvasBlockData: {
                                                    view: 'code',
                                                    language: 'json',
                                                    title: 'Raw Tool Output',
                                                    content: JSON.stringify(msg.rawToolOutput, null, 2)
                                                }
                                            })}
                                            className="absolute -right-8 top-2 p-1.5 bg-white rounded-full border border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-300 shadow-sm opacity-100 md:opacity-0 group-hover/jsonbox:opacity-100 transition-all transform md:translate-x-[-5px] group-hover/jsonbox:translate-x-0 z-10"
                                            title="Add JSON to Document"
                                        >
                                            <PlusCircle size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex w-full justify-start">
                        <div className="flex max-w-[80%] flex-row items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                                <Sparkles size={14} className="text-white" />
                            </div>
                            <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg shadow-sm">
                                <div className="flex space-x-1">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-gray-200 bg-white">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.txt,application/pdf"
                        multiple
                    />

                    <div className={`
				relative flex flex-col bg-gray-50 border border-gray-200 rounded-lg transition-all shadow-sm focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent
				${selectedFiles.length > 0 ? 'p-2' : 'p-0'}
			`}>
                        {selectedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2 p-1 max-h-[100px] overflow-y-auto">
                                {selectedFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center space-x-2 bg-white border border-gray-200 rounded-md pl-2 pr-1 py-1.5 shadow-sm animate-in zoom-in-50 duration-200">
                                        <div className="flex items-center space-x-2 max-w-[150px]">
                                            <FileIcon size={12} className="text-gray-500 shrink-0" />
                                            <p className="text-xs font-medium text-gray-900 truncate" title={file.file.name}>{file.file.name}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="text-gray-400 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-end gap-2 p-3">
                            <button
                                type="button"
                                className={`p-1 rounded-md transition-colors ${selectedFiles.length > 0 ? 'text-gray-900 bg-gray-200' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
                                title="Attach Documents"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Paperclip size={18} />
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={selectedFiles.length > 0 ? "Ask about these documents..." : "Ask for analysis, summaries, or insights..."}
                                className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-900 placeholder-gray-400 focus:outline-none min-h-[24px]"
                            />
                            <button
                                type="submit"
                                disabled={(!input.trim() && selectedFiles.length === 0) || isTyping}
                                className="p-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ArrowUp size={16} />
                            </button>
                        </div>
                    </div>
                </form>
                <div className="mt-2 text-center">
                    <p className="text-[10px] text-gray-400">
                        AI can make mistakes. Please review generated documents.
                    </p>
                </div>
            </div>

            {attachmentToDelete && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 transform transition-all scale-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Attachment?</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            This will permanently delete this file from the conversation and database. This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setAttachmentToDelete(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (attachmentToDelete) {
                                        onDeleteAttachment(attachmentToDelete.messageId, attachmentToDelete.attachmentId);
                                        setAttachmentToDelete(null);
                                    }
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};