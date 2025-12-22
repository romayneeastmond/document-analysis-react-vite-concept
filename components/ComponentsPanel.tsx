import React, { useState, useRef, useEffect } from 'react';
import { Database, Globe, Code, FileText, MoreVertical, Bot, Power, Rss, Search, Calendar, ChevronRight } from 'lucide-react';
import { Agent } from '../types';

interface ComponentsPanelProps {
    agents: Agent[];
    mcpConnections: Record<number, any>;
    onToggleAgentStatus: (id: number) => void;
    onToggleToolStatus: (agentId: number, toolName: string) => void;
    onToggleAllTools: (agentId: number, activate: boolean) => void;
    onConnectionChange?: (agentId: number, connection: any) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
    'documentExtraction': FileText,
    'getRssFeed': Rss,
    'searchFeed': Search,
    'findEntriesByDate': Calendar
};

interface AgentCardProps {
    agent: Agent;
    activeMenuId: number | null;
    setActiveMenuId: (id: number | null) => void;
    onToggleAgentStatus: (id: number) => void;
    onToggleToolStatus: (agentId: number, toolName: string) => void;
    onToggleAllTools: (agentId: number, activate: boolean) => void;
    menuRef: React.RefObject<HTMLDivElement>;
    onConnectionChange?: (agentId: number, connection: any) => void;
    toolCount?: string;
    connection?: any;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, activeMenuId, setActiveMenuId, onToggleAgentStatus, menuRef, toolCount }) => {
    const Icon = (agent.tool && ICON_MAP[agent.tool]) ? ICON_MAP[agent.tool] : Bot;
    const isActive = activeMenuId === agent.id;

    return (
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all bg-white group relative">
            <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${agent.status === 'Active' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                    <Icon size={20} />
                </div>
                <div>
                    <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-900">{agent.name}</h3>
                        {toolCount && (
                            <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[9px] font-bold text-gray-500 uppercase tracking-tighter">
                                {toolCount} Tools
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">{agent.description}</p>
                    {agent.server && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{agent.server}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center space-x-3">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${agent.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                    {agent.status}
                </span>

                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isActive ? null : agent.id);
                        }}
                        className={`p-2 rounded-md transition-colors ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <MoreVertical size={16} />
                    </button>

                    {isActive && (
                        <div
                            ref={menuRef}
                            className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right"
                        >
                            <div className="py-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleAgentStatus(agent.id);
                                        setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm flex items-center space-x-2 hover:bg-gray-50 transition-colors"
                                >
                                    {agent.status === 'Active' ? (
                                        <>
                                            <Power size={14} className="text-red-500" />
                                            <span className="text-gray-700">Deactivate</span>
                                        </>
                                    ) : (
                                        <>
                                            <Power size={14} className="text-green-500" />
                                            <span className="text-gray-700">Activate</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const McpAgentRow: React.FC<AgentCardProps> = (props) => {
    const { agent, connection = { state: 'disconnected', tools: [] } } = props;
    const [isExpanded, setIsExpanded] = useState(false);

    const activeToolsCount = connection.tools ? (connection.tools.length - (agent.disabledTools?.length || 0)) : 0;
    const totalToolsCount = connection.tools ? connection.tools.length : 0;
    const toolCountStr = connection.state === 'ready' ? `${activeToolsCount}/${totalToolsCount}` : undefined;

    return (
        <div className="space-y-2">
            <AgentCard {...props} toolCount={toolCountStr} />
            {connection.state === 'ready' && connection.tools && connection.tools.length > 0 && (
                <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                    <div
                        className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100/50 transition-colors"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider transition-colors">
                            Available Tools
                        </h4>

                        <div className="flex items-center space-x-3">
                            {isExpanded && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        props.onToggleAllTools(agent.id, (agent.disabledTools?.length || 0) > 0);
                                    }}
                                    className="text-[10px] font-bold text-gray-500 hover:text-gray-900 uppercase tracking-tight flex items-center space-x-1 py-1 px-2 hover:bg-white rounded-md transition-all border border-transparent hover:border-gray-200 shadow-sm"
                                >
                                    {(agent.disabledTools?.length || 0) > 0 ? 'Activate All' : 'Deactivate All'}
                                </button>
                            )}
                            <ChevronRight
                                size={14}
                                className={`text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                            />
                        </div>
                    </div>

                    {isExpanded && (
                        <div className="p-3 pt-0 grid gap-2 border-t border-gray-100 mt-2">
                            {connection.tools.map((tool: any) => {
                                const isDisabled = agent.disabledTools?.includes(tool.name);
                                return (
                                    <div
                                        key={tool.name}
                                        onClick={() => props.onToggleToolStatus(agent.id, tool.name)}
                                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:shadow-md transition-all group/tool cursor-pointer active:scale-[0.98]"
                                    >
                                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2">
                                                    <div className="p-1.5 bg-gray-50 rounded-md border border-gray-100 shrink-0 group-hover/tool:bg-gray-100 transition-colors">
                                                        <Code size={12} className="text-gray-600" />
                                                    </div>
                                                    <div className="text-sm font-semibold text-gray-900 truncate">
                                                        {tool.name}
                                                    </div>
                                                </div>
                                                {tool.description && (
                                                    <div className="text-xs text-gray-500 mt-1 line-clamp-1 leading-relaxed">
                                                        {tool.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="ml-4 shrink-0">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-sm ${!isDisabled
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-gray-50 text-gray-400 border-gray-200'
                                                }`}>
                                                {!isDisabled ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const ComponentsPanel: React.FC<ComponentsPanelProps> = ({ agents, mcpConnections, onToggleAgentStatus, onToggleToolStatus, onToggleAllTools, onConnectionChange }) => {
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const functionTools = agents.filter(agent => agent.tool !== 'mcp');
    const mcpServers = agents.filter(agent => agent.tool === 'mcp');

    return (
        <div className="h-full flex flex-col bg-white relative animate-in fade-in duration-300">
            <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-gray-500" />
                    <h2 className="text-sm font-medium text-gray-900">Components</h2>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto">
                    <div className="mb-6">
                        <h3 className="text-lg font-medium text-gray-900">Function Tools</h3>
                        <p className="text-sm text-gray-500">Manage the active Function Tools available to your assistant.</p>
                    </div>

                    <div className="space-y-3">
                        {functionTools.map(agent => (
                            <AgentCard
                                key={agent.id}
                                agent={agent}
                                activeMenuId={activeMenuId}
                                setActiveMenuId={setActiveMenuId}
                                onToggleAgentStatus={onToggleAgentStatus}
                                onToggleToolStatus={onToggleToolStatus}
                                onToggleAllTools={onToggleAllTools}
                                menuRef={menuRef}
                            />
                        ))}
                    </div>

                    <div className="mt-8 mb-6">
                        <h3 className="text-lg font-medium text-gray-900">MCP Servers</h3>
                        <p className="text-sm text-gray-500">Manage the active MCP Servers available to your assistant.</p>
                    </div>

                    <div className="space-y-3">
                        {mcpServers.map(agent => (
                            <McpAgentRow
                                key={agent.id}
                                agent={agent}
                                activeMenuId={activeMenuId}
                                setActiveMenuId={setActiveMenuId}
                                onToggleAgentStatus={onToggleAgentStatus}
                                onToggleToolStatus={onToggleToolStatus}
                                onToggleAllTools={onToggleAllTools}
                                menuRef={menuRef}
                                onConnectionChange={onConnectionChange}
                                connection={mcpConnections[agent.id]}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
