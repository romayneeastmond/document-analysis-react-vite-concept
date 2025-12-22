
import React, { useState, useCallback, useEffect } from 'react';
import { CanvasPanel } from './components/CanvasPanel';
import { ChatPanel, AttachmentFile } from './components/ChatPanel';
import { ComponentsPanel } from './components/ComponentsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { AzureOpenAIService } from './services/azure';
import { Message, CanvasState, Agent, CanvasBlock, BlockType } from './types';
import { Layout, Box, Settings, FileText, History, PanelLeftClose, ChevronRight, Plus, Trash2, Menu, Sparkles, X } from 'lucide-react';
import { parse } from 'marked';
import { generateGUID } from './utils';
import { CosmosClient } from "@azure/cosmos";
import { CosmosConversationService } from "./services/cosmodb";
import { McpConnectionTracker } from './components/McpConnectionTracker';

const llmService = new AzureOpenAIService();

const cosmosEndpoint = process.env.AZURE_COSMOS_ENDPOINT || "";
const cosmosKey = process.env.AZURE_COSMOS_KEY || "";
const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
const conversationService = new CosmosConversationService(cosmosClient);

type ViewType = 'canvas' | 'components' | 'settings';

const WELCOME_MESSAGE = "Hello! I'm your assistant. I can help you analyze documents. Chat with me, and click 'Add to Document' (+) on my responses to build your report.";

function App() {
    const [activeView, setActiveView] = useState<ViewType>('canvas');
    const [isMenuExpanded, setIsMenuExpanded] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const [historyItems, setHistoryItems] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'model',
            content: WELCOME_MESSAGE,
            timestamp: new Date(),
        }
    ]);

    const [canvasState, setCanvasState] = useState<CanvasState>({
        sessionId: generateGUID(),
        title: 'New Document Analysis',
        blocks: []
    });

    const [agents, setAgents] = useState<Agent[]>([
        { id: 1, name: 'Document Extraction', description: 'Extracts text from attachments', status: 'Active', tool: 'documentExtraction' },
        { id: 2, name: 'Hello World', description: 'A test MCP Server', status: 'Inactive', tool: 'mcp', server: 'https://dev-mcp-server-hello-world.azurewebsites.net/mcp' },
        { id: 3, name: 'Examples', description: 'Random examples MCP Server', status: 'Inactive', tool: 'mcp', server: 'https://dev-mcp-server-example.azurewebsites.net/mcp' },
    ]);

    const [mcpConnections, setMcpConnections] = useState<Record<number, any>>({});

    const handleMcpConnectionChange = useCallback((agentId: number, connection: any) => {
        setMcpConnections(prev => {
            return { ...prev, [agentId]: connection };
        });
    }, []);

    const fetchHistory = useCallback(async () => {
        const userId = "user-1";

        try {
            const conversations = await conversationService.listConversations(userId);

            const cosmosItems = conversations
                .map(c => ({
                    id: c.id,
                    title: c.title,
                    date: c.lastMessageAt || c.updatedAt || c.createdAt
                }));

            const combined = [...cosmosItems].sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            const formatted = combined.map(item => ({
                ...item,
                date: new Date(item.date).toLocaleDateString() + ' ' + new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

            setHistoryItems(formatted);
        } catch (_error) {

        }
    }, []);

    const handleSendMessage = useCallback(async (content: string, attachments: AttachmentFile[] = []) => {
        const newUserMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date(),
            attachments: attachments.map(f => ({ id: f.id, name: f.file.name, type: f.file.type }))
        };

        setMessages(prev => [...prev, newUserMsg]);
        setIsTyping(true);

        conversationService.addMessage({
            conversationId: canvasState.sessionId || 'unknown',
            userId: "user-1",
            role: 'user',
            content: content,
            sequenceNumber: messages.length,
            attachments: attachments.map(a => ({
                id: a.id,
                name: a.file.name,
                type: a.file.type,
                size: a.file.size
            }))
        }).catch(e => console.error("Failed to save user message:", e));

        try {
            if (llmService.setCurrentFiles) {
                llmService.setCurrentFiles(attachments);
            }

            const attachmentContext = attachments.length > 0
                ? `\n\n[System Note: User attached files: ${attachments.map(f => `"${f.file.name}" (ID: ${f.id}, Type: ${f.file.type})`).join(", ")}. Use the 'documentExtraction' tool with these GUIDs and filetypes to analyze the content if needed.]`
                : "";

            const contextContent = content + attachmentContext;
            const result = await llmService.sendMessage(contextContent, messages);

            const newModelMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: result.text,
                timestamp: new Date(),
                canvasBlockData: result.toolOutput,
                rawToolOutput: result.rawToolOutput
            };

            setMessages(prev => [...prev, newModelMsg]);

            if (result.rawToolOutput && Array.isArray(result.rawToolOutput)) {
                const docResults = result.rawToolOutput;

                const hasNewIds = docResults.some(doc => doc.id && doc.id !== "");

                if (hasNewIds && newUserMsg.attachments) {
                    const usedBackendIds = new Set<string>();
                    const updatedAttachments = newUserMsg.attachments.map(att => {
                        const doc = docResults.find(d =>
                            (d.filename === att.name || d.name === att.name) &&
                            d.id &&
                            !usedBackendIds.has(d.id)
                        );

                        if (doc && doc.id) {
                            usedBackendIds.add(doc.id);

                            return { ...att, id: doc.id, documentId: doc.id };
                        }
                        return att;
                    });

                    setMessages(prev => prev.map(m =>
                        m.id === newUserMsg.id ? { ...m, attachments: updatedAttachments } : m
                    ));

                    conversationService.updateMessage(
                        canvasState.sessionId || 'unknown',
                        newUserMsg.id,
                        "user-1",
                        { attachments: updatedAttachments } as any
                    ).catch(e => console.error("App: Failed to sync backend IDs to Cosmos:", e));
                }
            }

            conversationService.addMessage({
                conversationId: canvasState.sessionId || 'unknown',
                userId: "user-1",
                role: 'assistant',
                content: result.text,
                sequenceNumber: messages.length + 1,
                toolOutput: result.toolOutput,
                rawToolOutput: result.rawToolOutput
            } as any).catch(e => console.error("Failed to save model message:", e));
        } catch (_error) {

        } finally {
            setIsTyping(false);

            fetchHistory();
        }
    }, [messages, fetchHistory]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    useEffect(() => {
        llmService.setAgents(agents.filter((agent) => agent.tool !== undefined));
        llmService.setConversationId(canvasState.sessionId || 'unknown');

        if (llmService.setMcpConnections) {
            const connections = Object.entries(mcpConnections).map(([agentIdStr, conn]) => {
                return {
                    ...(conn as any),
                    agentId: parseInt(agentIdStr, 10)
                };
            });

            llmService.setMcpConnections(connections);
        }
    }, [agents, mcpConnections, canvasState.sessionId]);

    useEffect(() => {
        const saveCanvas = async () => {
            if (!canvasState.sessionId) return;

            const userId = "user-1";

            try {
                await conversationService.updateConversation(canvasState.sessionId, userId, {
                    canvasBlocks: canvasState.blocks,
                    title: canvasState.title
                });
                fetchHistory();
            } catch (_error) {

            }
        };

        const timeout = setTimeout(saveCanvas, 2000);

        return () => clearTimeout(timeout);
    }, [canvasState.blocks, canvasState.title, canvasState.sessionId, fetchHistory]);

    useEffect(() => {
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        const id = params.get('id');

        if (id) {
            handleLoadHistory({ id, title: 'Loading...' });
        } else {
            if (canvasState.sessionId) {
                url.searchParams.set('id', canvasState.sessionId);
                window.history.replaceState({}, '', url);
            }
        }
    }, []);

    const handleAddBlock = (type: BlockType, content: string = '', extraData?: Partial<CanvasBlock>) => {
        const newBlock: CanvasBlock = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            content: content,
            ...extraData
        };

        setCanvasState(prev => ({
            ...prev,
            blocks: [...prev.blocks, newBlock],
            isLoading: false
        }));

        setActiveView('canvas');
        setIsMobileChatOpen(false);
    };

    const handleAddToCanvas = (message: Message) => {
        if (message.canvasBlockData) {
            const viewType = ['markdown', 'code', 'dashboard'].includes(message.canvasBlockData.view)
                ? message.canvasBlockData.view as BlockType
                : 'markdown';

            let finalContent = message.canvasBlockData.content || '';
            if (viewType === 'markdown' && finalContent) {
                try {
                    finalContent = parse(finalContent) as string;
                } catch (_error) {

                }
            }

            handleAddBlock(
                viewType,
                finalContent,
                {
                    language: message.canvasBlockData.language,
                    dashboardData: message.canvasBlockData.dashboardData,
                    sourceLabel: message.canvasBlockData.sourceLabel
                }
            );
        } else {
            let content = message.content;

            try {
                content = parse(content) as string;
            } catch (_error) {

            }

            handleAddBlock('markdown', content);
        }
    };

    const handleUpdateBlock = (id: string, newContent: string) => {
        setCanvasState(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => b.id === id ? { ...b, content: newContent } : b)
        }));
    };

    const handleDeleteBlock = (id: string) => {
        setCanvasState(prev => ({
            ...prev,
            blocks: prev.blocks.filter(b => b.id !== id)
        }));
    };

    const handleMoveBlock = (dragIndex: number, hoverIndex: number) => {
        setCanvasState(prev => {
            const newBlocks = [...prev.blocks];
            const draggedBlock = newBlocks[dragIndex];
            newBlocks.splice(dragIndex, 1);
            newBlocks.splice(hoverIndex, 0, draggedBlock);
            return { ...prev, blocks: newBlocks };
        });
    };

    const handleLoadHistory = async (item: { id: string, title: string }) => {
        if (canvasState.isLoading) return;

        const url = new URL(window.location.href);
        url.searchParams.set('id', item.id);
        window.history.pushState({}, '', url);

        setCanvasState(prev => ({ ...prev, isLoading: true, blocks: [] }));
        setMessages([]);
        setActiveView('canvas');
        setIsMobileSidebarOpen(false);

        try {
            const userId = "user-1";
            const conversation = await conversationService.getConversation(item.id, userId);

            if (conversation) {
                const conversationMessages = await conversationService.getMessages(item.id);

                const mappedMessages: Message[] = conversationMessages.map(msg => ({
                    id: msg.id,
                    role: (msg.role === 'tool' || msg.role === 'assistant') ? 'model' : (msg.role as 'user' | 'model'),
                    content: msg.content,
                    timestamp: new Date(msg.createdAt),
                    attachments: msg.attachments?.map(a => ({
                        id: a.id,
                        name: a.name,
                        type: a.type
                    })),
                    canvasBlockData: (msg as any).toolOutput,
                    rawToolOutput: (msg as any).rawToolOutput
                }));

                setMessages(mappedMessages);

                const blocks: CanvasBlock[] = conversation.canvasBlocks || ((conversation as any).canvasContent ? [{
                    id: generateGUID(),
                    type: 'markdown',
                    content: (conversation as any).canvasContent
                }] : []);

                setCanvasState({
                    sessionId: conversation.id,
                    title: conversation.title,
                    blocks: blocks,
                    isLoading: false
                });
            } else {
                handleNewChat();

                setMessages([{
                    id: 'welcome',
                    role: 'model',
                    content: WELCOME_MESSAGE,
                    timestamp: new Date()
                }]);
            }
        } catch (_error) {
            setCanvasState(prev => ({ ...prev, isLoading: false }));

            setMessages([{
                id: 'error',
                role: 'model',
                content: `Error loading conversation. Please try again or start a new chat.`,
                timestamp: new Date()
            }]);
        }
    };

    const handleDeleteHistory = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteConfirmationId(id);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmationId) return;
        const id = deleteConfirmationId;

        setHistoryItems(prev => prev.filter(item => item.id !== id));

        if (id === canvasState.sessionId) {
            handleNewChat();
        }

        try {
            await conversationService.deleteConversation(id, "user-1");
        } catch (_error) {

        }

        setDeleteConfirmationId(null);
    };

    const handleNewChat = () => {
        const newSessionId = generateGUID();

        const url = new URL(window.location.href);
        url.searchParams.set('id', newSessionId);
        window.history.pushState({}, '', url);

        setMessages([
            {
                id: 'welcome',
                role: 'model',
                content: WELCOME_MESSAGE,
                timestamp: new Date(),
            }
        ]);

        setCanvasState({
            sessionId: newSessionId,
            title: 'New Document Analysis',
            blocks: []
        });

        setActiveView('canvas');

        setIsMobileSidebarOpen(false);
    };

    const handleToggleAgentStatus = (id: number) => {
        setAgents(prevAgents => {
            const updatedAgents = prevAgents.map(agent => {
                if (agent.id === id) {
                    const newStatus = agent.status === 'Active' ? 'Inactive' : 'Active';

                    return {
                        ...agent,
                        status: newStatus,
                        disabledTools: newStatus === 'Active' ? [] : (agent.disabledTools || [])
                    };
                }
                return agent;
            });
            return updatedAgents;
        });
    };

    const handleToggleToolStatus = (agentId: number, toolName: string) => {
        setAgents(prevAgents => {
            const updatedAgents = prevAgents.map(agent => {
                if (agent.id === agentId) {
                    const disabledTools = agent.disabledTools || [];
                    const isCurrentlyDisabled = disabledTools.includes(toolName);
                    const newDisabledTools = isCurrentlyDisabled
                        ? disabledTools.filter(t => t !== toolName)
                        : [...disabledTools, toolName];

                    const connection = mcpConnections[agentId];
                    const allToolNames = (connection as any)?.tools?.map((t: any) => t.name) || [];

                    let newStatus = agent.status;
                    if (allToolNames.length > 0) {
                        const activeToolsCount = allToolNames.length - newDisabledTools.length;
                        if (activeToolsCount === 0) {
                            newStatus = 'Inactive';
                        } else if (agent.status === 'Inactive' && activeToolsCount > 0) {
                            newStatus = 'Active';
                        }
                    }

                    return { ...agent, disabledTools: newDisabledTools, status: newStatus as 'Active' | 'Inactive' };
                }
                return agent;
            });
            return updatedAgents;
        });
    };

    const handleToggleAllTools = (agentId: number, activate: boolean) => {
        setAgents(prevAgents => {
            const updatedAgents = prevAgents.map(agent => {
                if (agent.id === agentId) {
                    if (activate) {
                        return { ...agent, disabledTools: [], status: 'Active' as const };
                    } else {
                        const connection = mcpConnections[agentId];
                        const allToolNames = connection?.tools?.map((t: any) => t.name) || [];
                        return { ...agent, disabledTools: allToolNames, status: 'Inactive' as const };
                    }
                }
                return agent;
            });
            return updatedAgents;
        });
    };

    const handleTitleChange = (newTitle: string) => {
        setCanvasState(prev => ({ ...prev, title: newTitle }));
    };

    const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
        <button
            onClick={() => {
                onClick();
                setIsMobileSidebarOpen(false);
            }}
            className={`
			flex items-center rounded-lg transition-all duration-200 group relative whitespace-nowrap
			${active ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
			${isMenuExpanded ? 'w-full px-3 py-2' : 'w-10 h-10 justify-center'}
		`}
        >
            <div className="shrink-0 flex items-center justify-center w-5 h-5">{icon}</div>

            <span className={`
			ml-3 text-sm font-medium transition-all duration-300
			${isMenuExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute left-10 pointer-events-none w-0'}
		`}>
                {label}
            </span>

            {!isMenuExpanded && (
                <div className="absolute left-12 bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-sm hidden md:block">
                    {label}
                </div>
            )}
        </button>
    );

    const handleDeleteAttachment = async (messageId: string, attachmentId: string) => {
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId && msg.attachments) {
                return {
                    ...msg,
                    attachments: msg.attachments.filter(a => a.id !== attachmentId)
                };
            }
            return msg;
        }));

        try {
            await conversationService.deleteAttachment(
                canvasState.sessionId || 'unknown',
                messageId,
                attachmentId,
                "user-1"
            );
        } catch (_error) {

        }
    };

    return (
        <div className="flex flex-col md:flex-row h-screen w-screen bg-gray-100 overflow-hidden relative">
            {agents.filter(a => a.tool === 'mcp').map(agent => (
                <McpConnectionTracker
                    key={agent.id}
                    agent={agent}
                    onConnectionChange={handleMcpConnectionChange}
                />
            ))}

            <div className="md:hidden h-14 bg-white border-b border-gray-200 flex items-center px-4 justify-between shrink-0 z-30">
                <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 -ml-2 text-gray-600">
                    <Menu size={20} />
                </button>
                <span className="font-semibold text-gray-900">DocuAssist</span>
                <div className="w-8" />
            </div>

            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            <div
                className={`
			bg-white border-r border-gray-200 flex flex-col py-4 shrink-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-all duration-300 ease-in-out
			fixed inset-y-0 left-0 z-50 md:relative md:z-20
			${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
			${isMenuExpanded ? 'w-80 items-start' : 'w-14 items-center'}
		`}
            >
                <div className={`mb-6 flex items-center w-full ${isMenuExpanded ? 'px-4 justify-between' : 'justify-center'}`}>
                    <div className="flex items-center space-x-3 overflow-hidden">
                        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
                            <FileText size={18} />
                        </div>
                        {isMenuExpanded && (
                            <span className="font-semibold text-gray-900 truncate animate-in fade-in duration-300">DocuAssist</span>
                        )}
                    </div>

                    {isMenuExpanded && (
                        <button
                            onClick={() => {
                                setIsMenuExpanded(false);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors hidden md:block"
                        >
                            <PanelLeftClose size={16} />
                        </button>
                    )}

                    <button
                        onClick={() => setIsMobileSidebarOpen(false)}
                        className="p-1 text-gray-400 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors md:hidden"
                    >
                        <X size={16} />
                    </button>
                </div>

                <nav className={`flex flex-col w-full ${isMenuExpanded ? 'px-3' : 'px-2 items-center'}`}>
                    <button
                        onClick={handleNewChat}
                        className={`
					flex items-center rounded-lg transition-all duration-200 group relative whitespace-nowrap
					bg-gray-900 text-white hover:bg-gray-800 shadow-sm
					${isMenuExpanded ? 'w-full px-3 py-2' : 'w-10 h-10 justify-center'}
				`}
                    >
                        <div className="shrink-0 flex items-center justify-center w-5 h-5">
                            <Plus size={20} />
                        </div>

                        <span className={`
					ml-3 text-sm font-medium transition-all duration-300
					${isMenuExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute left-10 pointer-events-none w-0'}
				`}>
                            New Chat
                        </span>
                    </button>

                    <div className={`my-3 border-b border-gray-200 ${isMenuExpanded ? 'w-full' : 'w-8 mx-auto'}`} />

                    <div className="flex flex-col space-y-2 w-full">
                        <NavItem
                            icon={<Layout size={20} />}
                            label="Canvas"
                            active={activeView === 'canvas'}
                            onClick={() => setActiveView('canvas')}
                        />
                        <NavItem
                            icon={<Box size={20} />}
                            label="Components"
                            active={activeView === 'components'}
                            onClick={() => setActiveView('components')}
                        />
                        <NavItem
                            icon={<Settings size={20} />}
                            label="Settings"
                            active={activeView === 'settings'}
                            onClick={() => setActiveView('settings')}
                        />
                    </div>
                </nav>

                <div className={`my-4 border-t border-gray-100 w-full ${isMenuExpanded ? 'px-4' : 'px-2'}`} />

                <div className={`flex flex-col w-full flex-1 ${isMenuExpanded ? 'overflow-hidden px-3' : 'overflow-visible px-2 items-center'}`}>
                    <button
                        onClick={() => setIsMenuExpanded(true)}
                        className={`
					flex items-center rounded-lg transition-all duration-200 group relative
					${isMenuExpanded ? 'w-full px-3 py-2 text-gray-900 bg-gray-50' : 'w-10 h-10 justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-50'}
				 `}
                    >
                        <div className="shrink-0 flex items-center justify-center w-5 h-5">
                            <History size={20} />
                        </div>

                        {isMenuExpanded && (
                            <span className="ml-3 text-sm font-medium animate-in fade-in duration-300">History</span>
                        )}

                        {!isMenuExpanded && (
                            <div className="absolute left-12 bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-sm hidden md:block">
                                History
                            </div>
                        )}
                    </button>

                    {isMenuExpanded && (
                        <div className="mt-2 flex-1 overflow-y-auto animate-in fade-in slide-in-from-left-2 duration-300 pr-1 custom-scrollbar">
                            <div className="space-y-1 pt-2">
                                {historyItems.map(item => (
                                    <div key={item.id} className="relative group w-full">
                                        <button
                                            onClick={() => handleLoadHistory(item)}
                                            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all pr-8 group"
                                        >
                                            <p className="text-sm text-gray-700 font-medium line-clamp-2 group-hover:text-gray-900 leading-tight text-wrap">{item.title}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{item.date}</p>
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteHistory(e, item.id)}
                                            className="absolute right-1 top-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                                            title="Delete conversation"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-0 md:p-4 md:gap-4 relative">

                <div className="w-full md:flex-[3] h-full relative bg-white md:rounded-2xl border-x-0 md:border border-gray-200 shadow-sm overflow-hidden z-10">
                    <div className={`h-full w-full ${activeView === 'canvas' ? 'block' : 'hidden'}`}>
                        <CanvasPanel
                            state={canvasState}
                            onTitleChange={handleTitleChange}
                            onUpdateBlock={handleUpdateBlock}
                            onDeleteBlock={handleDeleteBlock}
                            onMoveBlock={handleMoveBlock}
                            onAddBlock={handleAddBlock}
                        />
                    </div>
                    <div className={`h-full w-full ${activeView === 'components' ? 'block' : 'hidden'}`}>
                        <ComponentsPanel
                            agents={agents}
                            mcpConnections={mcpConnections}
                            onToggleAgentStatus={handleToggleAgentStatus}
                            onToggleToolStatus={handleToggleToolStatus}
                            onToggleAllTools={handleToggleAllTools}
                            onConnectionChange={handleMcpConnectionChange}
                        />
                    </div>
                    <div className={`h-full w-full ${activeView === 'settings' ? 'block' : 'hidden'}`}>
                        <SettingsPanel />
                    </div>
                </div>

                <div className={`
			md:flex-[1] md:min-w-[350px] md:max-w-[450px] h-full bg-white md:rounded-2xl border border-gray-200 shadow-sm overflow-hidden
			fixed inset-0 z-40 md:static md:z-auto transition-transform duration-300 ease-in-out
			${isMobileChatOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
		`}>
                    <ChatPanel
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        isTyping={isTyping}
                        agents={agents}
                        mcpConnections={mcpConnections}
                        onShowComponents={() => {
                            setActiveView('components');
                            setIsMobileChatOpen(false);
                        }}
                        onAddToCanvas={handleAddToCanvas}
                        onCloseMobile={() => setIsMobileChatOpen(false)}
                        onDeleteAttachment={handleDeleteAttachment}
                    />
                </div>
            </div>

            <button
                onClick={() => setIsMobileChatOpen(true)}
                className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-gray-900 text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:bg-gray-800 transition-colors"
            >
                <Sparkles size={24} />
            </button>

            {deleteConfirmationId && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 transform transition-all scale-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Conversation?</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            This will permanently delete this conversation and all associated files. This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setDeleteConfirmationId(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
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
}

export default App;
