
import React, { useState, useRef, useEffect } from 'react';
import { CanvasState, DashboardData, CanvasBlock, BlockType } from '../types';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Loader2, FileText, Download, GripVertical, X, Image as ImageIcon, Type, Bold, Italic, Heading1, Heading2, List, Users, File, Presentation, Pilcrow } from 'lucide-react';

interface CanvasPanelProps {
    state: CanvasState;
    onTitleChange?: (newTitle: string) => void;
    onUpdateBlock: (id: string, newContent: string) => void;
    onDeleteBlock: (id: string) => void;
    onMoveBlock: (dragIndex: number, hoverIndex: number) => void;
    onAddBlock: (type: BlockType, content?: string, extraData?: Partial<CanvasBlock>) => void;
}

const DashboardView: React.FC<{ data?: DashboardData }> = ({ data }) => {
    if (!data) return null;

    return (
        <div className="p-6 space-y-6 select-none pointer-events-none">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">{data.title}</h2>
                <p className="text-gray-500 text-sm">{data.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.stats.map((stat, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                        <div className="mt-1 flex items-baseline space-x-2">
                            <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                            {stat.change && (
                                <span className={`text-xs font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                                    {stat.change}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Analytics Overview</h3>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.chartData}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#111827" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="name" hide />
                            <YAxis hide />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#111827"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const CodeView: React.FC<{ content?: string; language?: string }> = ({ content, language }) => (
    <div className="flex flex-col border rounded-md overflow-hidden bg-gray-50">
        <div className="bg-gray-100 px-3 py-1.5 flex justify-between items-center border-b border-gray-200">
            <span className="text-xs font-mono text-gray-500 uppercase">{language || 'text'}</span>
        </div>
        <div className="p-3 overflow-x-auto">
            <pre className="text-xs font-mono text-gray-800 leading-relaxed whitespace-pre-wrap break-all">
                {content}
            </pre>
        </div>
    </div>
);

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center text-gray-400 p-8 text-center min-h-[50vh]">
        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
            <FileText className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Document Analysis</h3>
        <p className="text-sm text-gray-500 max-w-xs">
            Start by adding text, images, or asking the assistant for analysis.
        </p>
    </div>
);

const BlockItem: React.FC<{
    block: CanvasBlock;
    index: number;
    onUpdate: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onDragStart: (e: React.DragEvent, index: number) => void;
    onDragOver: (e: React.DragEvent, index: number) => void;
    onDrop: (e: React.DragEvent, index: number) => void;
}> = ({ block, index, onUpdate, onDelete, onDragStart, onDragOver, onDrop }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (contentRef.current && block.type === 'markdown') {
            if (contentRef.current.innerHTML !== block.content) {
                contentRef.current.innerHTML = block.content || '';
            }
        }
    }, [block.id, block.content]);

    const handleBlur = () => {
        setIsFocused(false);
        if (contentRef.current && block.type === 'markdown') {
            onUpdate(block.id, contentRef.current.innerHTML);
        }
    };

    const applyFormat = (command: string, value?: string) => {
        document.execCommand(command, false, value);
        contentRef.current?.focus();
    };

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDrop={(e) => onDrop(e, index)}
            className={`
		group relative mb-4 rounded-xl border transition-all duration-200 bg-white
		${isFocused ? 'ring-2 ring-gray-900 border-transparent shadow-md' : 'border-gray-200 hover:border-gray-300'}
	  `}
        >
            {isFocused && block.type === 'markdown' && (
                <div className="absolute -top-11 left-0 bg-white shadow-lg border border-gray-200 rounded-lg flex items-center p-1 z-30 space-x-0.5 animate-in fade-in zoom-in-95 duration-100 overflow-x-auto max-w-full">
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 shrink-0" title="Bold">
                        <Bold size={14} />
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 shrink-0" title="Italic">
                        <Italic size={14} />
                    </button>
                    <div className="w-px h-4 bg-gray-200 mx-1 shrink-0" />
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat('formatBlock', 'H1'); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 shrink-0" title="Heading 1">
                        <Heading1 size={14} />
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat('formatBlock', 'H2'); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 shrink-0" title="Heading 2">
                        <Heading2 size={14} />
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat('formatBlock', 'P'); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 shrink-0" title="Paragraph">
                        <Pilcrow size={14} />
                    </button>
                    <div className="w-px h-4 bg-gray-200 mx-1 shrink-0" />
                    <button onMouseDown={(e) => { e.preventDefault(); applyFormat('insertUnorderedList'); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 shrink-0" title="Bullet List">
                        <List size={14} />
                    </button>
                </div>
            )}

            <div className="absolute -left-10 top-2 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex">
                <button className="p-1.5 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing" title="Drag to reorder">
                    <GripVertical size={16} />
                </button>
            </div>

            <div className="absolute right-2 top-2 md:-right-3 md:-top-3 md:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(block.id);
                    }}
                    className="p-1.5 bg-white rounded-full text-gray-400 hover:text-red-600 border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    title="Remove block"
                    type="button"
                >
                    <X size={14} />
                </button>
            </div>

            {block.sourceLabel && (
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex items-center space-x-2 rounded-t-xl">
                    <div className="p-1 bg-gray-200 rounded-full">
                        <Users size={12} className="text-gray-600" />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{block.sourceLabel}</span>
                </div>
            )}

            <div className={`p-4 md:p-6 ${block.sourceLabel ? 'pt-4' : ''}`}>
                {block.type === 'markdown' && (
                    <div
                        ref={contentRef}
                        contentEditable
                        suppressContentEditableWarning
                        onFocus={() => setIsFocused(true)}
                        onBlur={handleBlur}
                        className="prose prose-gray prose-sm max-w-none focus:outline-none whitespace-normal empty:before:content-['Type_something...'] empty:before:text-gray-300 min-h-[24px]"
                        dangerouslySetInnerHTML={{ __html: block.content || '' }}
                    />
                )}

                {block.type === 'image' && (
                    <div className="flex justify-center bg-gray-50 rounded-lg border border-gray-100 p-2">
                        {block.content ? (
                            <img src={block.content} alt="User uploaded" className="max-w-full h-auto rounded shadow-sm max-h-[600px] object-contain" />
                        ) : (
                            <div className="text-gray-400 flex flex-col items-center py-8">
                                <ImageIcon size={32} className="mb-2" />
                                <span className="text-xs">Image unavailable</span>
                            </div>
                        )}
                    </div>
                )}

                {block.type === 'dashboard' && <DashboardView data={block.dashboardData} />}
                {block.type === 'code' && <CodeView content={block.content} language={block.language} />}
            </div>
        </div>
    );
};

export const CanvasPanel: React.FC<CanvasPanelProps> = ({ state, onTitleChange, onUpdateBlock, onDeleteBlock, onMoveBlock, onAddBlock }) => {
    const [showExportMenu, setShowExportMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        console.log('Current canvas state:', state);
    }, [state]);

    const handleExport = (format: 'markdown' | 'word' | 'text' | 'powerpoint') => {
        if (state.blocks.length === 0) return;

        const safeTitle = (state.title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        let content = '';
        let mimeType = 'text/plain';
        let extension = 'txt';

        const generateMarkdown = () => {
            let md = `# ${state.title || 'Document'}\n\n`;
            state.blocks.forEach(block => {
                if (block.sourceLabel) md += `> Source: ${block.sourceLabel}\n\n`;
                if (block.type === 'markdown') {
                    md += `${block.content}\n\n`;
                } else if (block.type === 'code') {
                    md += `\`\`\`${block.language || ''}\n${block.content}\n\`\`\`\n\n`;
                } else if (block.type === 'dashboard') {
                    md += `## ${block.dashboardData?.title}\n${block.dashboardData?.description}\n\n`;
                } else if (block.type === 'image') {
                    md += `![Image](${block.content})\n\n`;
                }
            });
            return md;
        };

        const generateText = () => {
            let txt = `${state.title || 'Document'}\n\n`;
            state.blocks.forEach(block => {
                if (block.sourceLabel) txt += `Source: ${block.sourceLabel}\n\n`;
                if (block.type === 'markdown') {
                    const tmp = document.createElement('DIV');
                    tmp.innerHTML = block.content || '';
                    txt += (tmp.textContent || '') + '\n\n';
                } else if (block.type === 'code') {
                    txt += `[CODE: ${block.language}]\n${block.content}\n\n`;
                } else if (block.type === 'dashboard') {
                    txt += `[DASHBOARD: ${block.dashboardData?.title}]\n${block.dashboardData?.description}\n\n`;
                }
            });
            return txt;
        };

        const generateHTMLForWord = () => {
            let html = `
			<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
			<head><meta charset='utf-8'><title>${state.title}</title></head><body>
			<h1>${state.title}</h1>
		  `;
            state.blocks.forEach(block => {
                if (block.sourceLabel) html += `<p style="color:#666;font-size:10pt;"><em>Source: ${block.sourceLabel}</em></p>`;
                if (block.type === 'markdown') {
                    html += `<div>${block.content}</div>`;
                } else if (block.type === 'code') {
                    html += `<pre style="background:#f5f5f5;padding:10px;">${block.content}</pre>`;
                } else if (block.type === 'dashboard') {
                    html += `<h2>${block.dashboardData?.title}</h2><p>${block.dashboardData?.description}</p>`;
                } else if (block.type === 'image') {
                    html += `<img src="${block.content}" style="max-width:100%;" /><br/>`;
                }
                html += '<br/>';
            });
            html += '</body></html>';
            return html;
        };

        if (format === 'markdown') {
            content = generateMarkdown();
            mimeType = 'text/markdown';
            extension = 'md';
        } else if (format === 'text') {
            content = generateText();
            mimeType = 'text/plain';
            extension = 'txt';
        } else if (format === 'word') {
            content = generateHTMLForWord();
            mimeType = 'application/msword';
            extension = 'doc';
        } else if (format === 'powerpoint') {
            content = `PRESENTATION OUTLINE\nTitle: ${state.title}\n\n` + generateText();
            mimeType = 'text/plain';
            extension = 'txt';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeTitle}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (sourceIndex !== targetIndex) {
            onMoveBlock(sourceIndex, targetIndex);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onAddBlock('image', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="h-full flex flex-col bg-white relative">
            <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-white shrink-0 z-20">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex items-center space-x-2 text-gray-500 text-sm flex-1 min-w-0">
                        <input
                            type="text"
                            value={state.title || ''}
                            onChange={(e) => onTitleChange && onTitleChange(e.target.value)}
                            className="font-medium text-gray-900 bg-transparent border-none focus:ring-0 p-0 text-sm w-full focus:outline-none hover:bg-gray-50 focus:bg-gray-50 rounded px-2 -ml-2 transition-colors truncate"
                            placeholder="Document Title"
                        />
                    </div>
                </div>
                <div className="flex items-center space-x-3 pl-4 border-l border-gray-100 ml-2 relative">
                    {state.isLoading && (
                        <span className="flex items-center text-xs text-gray-500 hidden sm:flex">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Updating...
                        </span>
                    )}

                    <div ref={exportMenuRef} className="relative">
                        <button
                            onClick={() => handleExport('markdown')}
                            disabled={state.blocks.length === 0}
                            className={`
						flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all duration-200 text-xs font-medium
						${state.blocks.length === 0
                                    ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                                    : 'text-gray-700 bg-white hover:bg-gray-100 hover:text-gray-900 border border-gray-200 shadow-sm'}
					`}
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex items-center px-4 space-x-1 shrink-0 z-10 overflow-x-auto no-scrollbar mask-gradient-x">
                <button
                    onClick={() => onAddBlock('markdown', '')}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 text-xs font-medium transition-colors shrink-0"
                    title="Add Text Block"
                >
                    <Type size={14} />
                    <span>Add Text</span>
                </button>
                <div className="w-px h-4 bg-gray-200 mx-2 shrink-0" />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 text-xs font-medium transition-colors shrink-0"
                    title="Add Image"
                >
                    <ImageIcon size={14} />
                    <span>Add Image</span>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                />
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50/50">
                <div className="max-w-3xl mx-auto p-4 md:p-8 min-h-full flex flex-col">
                    {state.blocks.length === 0 && !state.isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <EmptyState />
                        </div>
                    ) : (
                        <div className="space-y-2 pb-8">
                            {state.blocks.map((block, index) => (
                                <BlockItem
                                    key={block.id}
                                    index={index}
                                    block={block}
                                    onUpdate={onUpdateBlock}
                                    onDelete={onDeleteBlock}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
