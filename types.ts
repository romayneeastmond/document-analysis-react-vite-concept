
export type Role = 'user' | 'model' | 'system';

export interface Message {
    id: string;
    role: Role;
    content: string;
    timestamp: Date;
    isError?: boolean;
    attachments?: {
        id: string;
        name: string;
        type: string;
    }[];
    canvasBlockData?: {
        view: string;
        content?: string;
        language?: string;
        dashboardData?: DashboardData;
        sourceLabel?: string;
        title?: string;
    };
    rawToolOutput?: any;
}

export interface ChartDataPoint {
    name: string;
    value: number;
    category?: string;
}

export interface DashboardData {
    title: string;
    description: string;
    stats: { label: string; value: string; change?: string; positive?: boolean }[];
    chartData: ChartDataPoint[];
}

export type BlockType = 'markdown' | 'code' | 'dashboard' | 'image';

export interface CanvasBlock {
    id: string;
    type: BlockType;
    content?: string;
    language?: string;
    dashboardData?: DashboardData;
    sourceLabel?: string;
}

export interface CanvasState {
    sessionId?: string;
    title?: string;
    blocks: CanvasBlock[];
    isLoading?: boolean;
}

export interface Agent {
    id: number;
    name: string;
    description: string;
    status: 'Active' | 'Inactive';
    tool?: string;
    server?: string;
    disabledTools?: string[];
}