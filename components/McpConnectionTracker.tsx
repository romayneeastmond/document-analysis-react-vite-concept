import React, { useEffect, useRef } from 'react';
import { useMcp } from 'use-mcp/react';
import { Agent } from '../types';

interface McpConnectionTrackerProps {
    agent: Agent;
    onConnectionChange: (agentId: number, connection: any) => void;
}

export const McpConnectionTracker: React.FC<McpConnectionTrackerProps> = ({ agent, onConnectionChange }) => {
    const prevConnectionRef = useRef<any>(null);

    const mcpOptions = React.useMemo(() => ({
        url: agent.status === 'Active' ? (agent.server || '') : '',
        debug: true,
        autoRetry: true,
        popupFeatures: 'width=500,height=600,resizable=yes,scrollbars=yes',
        transportType: 'http' as const
    }), [agent.server, agent.status]);

    const connection = useMcp(mcpOptions);

    useEffect(() => {
        const prev = prevConnectionRef.current;

        const toolsString = connection.tools ? JSON.stringify(connection.tools) : '';
        const prevToolsString = prev && prev.tools ? JSON.stringify(prev.tools) : '';

        const hasChanged = !prev ||
            prev.state !== connection.state ||
            toolsString !== prevToolsString;

        if (hasChanged) {
            prevConnectionRef.current = connection;
            onConnectionChange(agent.id, connection);
        }
    }, [connection, agent.id, onConnectionChange, agent.name]);

    return null;
};
