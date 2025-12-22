import { CanvasBlock } from '../types';

export interface Conversation {
    // Cosmos DB required fields
    id: string;                          // Unique conversation ID (UUID)
    _partitionKey?: string;              // Same as userId for efficient queries

    // Core fields
    userId: string;                      // User who owns the conversation
    title: string;                       // Conversation title/summary
    createdAt: string;                   // ISO 8601 timestamp
    updatedAt: string;                   // ISO 8601 timestamp
    lastMessageAt: string;               // ISO 8601 timestamp of last message
    canvasBlocks?: CanvasBlock[];              // Content produced by the canvas

    // Optional metadata
    metadata?: {
        tags?: string[];                 // User-defined tags
        favorite?: boolean;              // Starred/favorite flag
        archived?: boolean;              // Archive status
        model?: string;                  // AI model used (e.g., "gpt-4")
        totalMessages?: number;          // Message count cache
        totalTokens?: number;            // Total tokens used
    };

    // Cosmos DB system fields (auto-generated)
    _rid?: string;
    _self?: string;
    _etag?: string;
    _attachments?: string;
    _ts?: number;
}

export interface ConversationMessage {
    // Cosmos DB required fields
    id: string;                          // Unique message ID (UUID)
    _partitionKey?: string;              // Same as conversationId

    // Core fields
    conversationId: string;              // Parent conversation ID
    userId: string;                      // User ID (for cross-reference)
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;                     // Message content
    createdAt: string;                   // ISO 8601 timestamp
    sequenceNumber: number;              // Message order within conversation

    // Optional fields
    metadata?: {
        tokenCount?: number;             // Tokens in this message
        model?: string;                  // Model that generated this (if assistant)
        finishReason?: string;           // Completion reason
        latencyMs?: number;              // Response time
    };

    // Attachments
    attachments?: Array<{
        id: string;
        name: string;
        type: string;                    // MIME type
        size: number;                    // Bytes
        url?: string;                    // Storage URL
        documentId?: string;             // Reference to document in documents container
    }>;

    // Tool usage
    toolCalls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;           // JSON string
        };
    }>;

    toolOutput?: any;                    // Parsed tool output

    // Cosmos DB system fields
    _rid?: string;
    _self?: string;
    _etag?: string;
    _attachments?: string;
    _ts?: number;
}

export interface ConversationDocument {
    // Cosmos DB required fields
    id: string;                          // Unique document ID (UUID)
    _partitionKey?: string;              // Same as conversationId

    // Core fields
    conversationId: string;              // Parent conversation ID
    userId: string;                      // User ID (for cross-reference)
    messageId?: string;                  // Message that generated this document

    // Document metadata
    title: string;                       // Document title
    view: 'markdown' | 'code' | 'dashboard';
    createdAt: string;                   // ISO 8601 timestamp
    updatedAt: string;                   // ISO 8601 timestamp
    version: number;                     // Document version for tracking edits

    // Content
    content?: string;                    // Markdown or code content
    language?: string;                   // Programming language (if code)
    sourceLabel?: string;                // Source entity label

    // Dashboard data
    dashboardData?: {
        title: string;
        description: string;
        stats: Array<{
            label: string;
            value: string;
            change?: string;
            positive?: boolean;
        }>;
        chartData: Array<{
            name: string;
            value: number;
            category?: string;
        }>;
    };

    // Optional metadata
    metadata?: {
        tags?: string[];
        shared?: boolean;                // If document is shared
        exportedAt?: string;             // Last export timestamp
        format?: string;                 // Export format (pdf, docx, etc.)
    };

    // Cosmos DB system fields
    _rid?: string;
    _self?: string;
    _etag?: string;
    _attachments?: string;
    _ts?: number;
}

export const COSMOS_DB_CONFIG = {
    databaseName: "ConversationDB",
    containers: [
        {
            id: "conversations",
            partitionKey: {
                paths: ["/userId"],
                kind: "Hash"
            },
            indexingPolicy: {
                automatic: true,
                indexingMode: "consistent",
                includedPaths: [
                    { path: "/*" }
                ],
                excludedPaths: [
                    { path: "/\"_etag\"/?" },
                    { path: "/canvasBlocks/*" }
                ]
            },
            defaultTtl: -1,
            uniqueKeyPolicy: {
                uniqueKeys: []
            }
        },
        {
            id: "messages",
            partitionKey: {
                paths: ["/conversationId"],
                kind: "Hash"
            },
            indexingPolicy: {
                automatic: true,
                indexingMode: "consistent",
                includedPaths: [
                    { path: "/*" }
                ],
                excludedPaths: [
                    { path: "/content/?" },
                    { path: "/\"_etag\"/?" }
                ],
                compositeIndexes: [
                    [
                        { path: "/conversationId", order: "ascending" },
                        { path: "/sequenceNumber", order: "ascending" }
                    ]
                ]
            },
            defaultTtl: -1
        },
        {
            id: "documents",
            partitionKey: {
                paths: ["/conversationId"],
                kind: "Hash"
            },
            indexingPolicy: {
                automatic: true,
                indexingMode: "consistent",
                includedPaths: [
                    { path: "/*" }
                ],
                excludedPaths: [
                    { path: "/content/?" },
                    { path: "/dashboardData/?" },
                    { path: "/\"_etag\"/?" }
                ]
            },
            defaultTtl: -1
        }
    ]
};

export class CosmosConversationService {
    private database: any;
    private conversationsContainer: any;
    private messagesContainer: any;
    private documentsContainer: any;

    constructor(cosmosClient: any) {
        this.database = cosmosClient.database(COSMOS_DB_CONFIG.databaseName);
        this.conversationsContainer = this.database.container("conversations");
        this.messagesContainer = this.database.container("messages");
        this.documentsContainer = this.database.container("documents");
    }

    async createConversation(id: string, userId: string, title: string): Promise<Conversation> {
        const conversation: Conversation = {
            id,
            userId,
            title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessageAt: new Date().toISOString(),
            metadata: {
                totalMessages: 0,
                archived: false,
                favorite: false
            }
        };

        const { resource } = await this.conversationsContainer.items.create(conversation);
        return resource;
    }

    async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
        try {
            const { resource } = await this.conversationsContainer.item(conversationId, userId).read();
            return resource;
        } catch (error: any) {
            if (error.code === 404) return null;
            throw error;
        }
    }

    async listConversations(userId: string, limit: number = 50): Promise<Conversation[]> {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.lastMessageAt DESC OFFSET 0 LIMIT @limit",
            parameters: [
                { name: "@userId", value: userId },
                { name: "@limit", value: limit }
            ]
        };

        const { resources } = await this.conversationsContainer.items.query(querySpec).fetchAll();
        return resources;
    }

    async updateConversation(conversationId: string, userId: string, updates: Partial<Conversation>): Promise<Conversation> {
        let conversation = await this.getConversation(conversationId, userId);

        if (!conversation) {
            conversation = await this.createConversation(
                conversationId,
                userId,
                updates.title || "New Document Analysis"
            );
        }

        const updated = {
            ...conversation,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        const { resource } = await this.conversationsContainer.item(conversationId, userId).replace(updated);
        return resource;
    }

    async deleteConversation(conversationId: string, userId: string): Promise<void> {
        try {
            const messageQuerySpec = {
                query: "SELECT * FROM c WHERE c.conversationId = @conversationId",
                parameters: [{ name: "@conversationId", value: conversationId }]
            };
            const { resources: messages } = await this.messagesContainer.items.query(messageQuerySpec).fetchAll();

            await Promise.all(messages.map((msg: any) =>
                this.messagesContainer.item(msg.id, conversationId).delete()
            ));
        } catch (error) {
            console.error(`Failed to delete messages for conversation ${conversationId}:`, error);
        }

        try {
            const documentQuerySpec = {
                query: "SELECT * FROM c WHERE c.conversationId = @conversationId",
                parameters: [{ name: "@conversationId", value: conversationId }]
            };
            const { resources: documents } = await this.documentsContainer.items.query(documentQuerySpec).fetchAll();

            await Promise.all(documents.map((doc: any) =>
                this.documentsContainer.item(doc.id, conversationId).delete()
            ));
        } catch (error) {
            console.error(`Failed to delete documents for conversation ${conversationId}:`, error);
        }

        await this.conversationsContainer.item(conversationId, userId).delete();
    }

    async addMessage(message: Omit<ConversationMessage, 'id' | 'createdAt'>): Promise<ConversationMessage> {
        const newMessage: ConversationMessage = {
            ...message,
            id: this.generateId(),
            createdAt: new Date().toISOString()
        };

        const { resource } = await this.messagesContainer.items.create(newMessage);

        await this.updateConversation(message.conversationId, message.userId, {
            lastMessageAt: newMessage.createdAt,
            metadata: {
                totalMessages: (await this.getMessageCount(message.conversationId))
            }
        });

        return resource;
    }

    async getMessages(conversationId: string, limit: number = 100): Promise<ConversationMessage[]> {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.conversationId = @conversationId ORDER BY c.sequenceNumber ASC OFFSET 0 LIMIT @limit",
            parameters: [
                { name: "@conversationId", value: conversationId },
                { name: "@limit", value: limit }
            ]
        };

        const { resources } = await this.messagesContainer.items.query(querySpec).fetchAll();
        return resources;
    }

    async getMessageCount(conversationId: string): Promise<number> {
        const querySpec = {
            query: "SELECT VALUE COUNT(1) FROM c WHERE c.conversationId = @conversationId",
            parameters: [{ name: "@conversationId", value: conversationId }]
        };

        const { resources } = await this.messagesContainer.items.query(querySpec).fetchAll();
        return resources[0] || 0;
    }

    async saveDocument(document: Omit<ConversationDocument, 'createdAt' | 'updatedAt' | 'version'>): Promise<ConversationDocument> {
        const newDocument: ConversationDocument = {
            ...document,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
        };

        const { resource } = await this.documentsContainer.items.create(newDocument);
        return resource;
    }

    async getDocuments(conversationId: string): Promise<ConversationDocument[]> {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.conversationId = @conversationId ORDER BY c.createdAt DESC",
            parameters: [{ name: "@conversationId", value: conversationId }]
        };

        const { resources } = await this.documentsContainer.items.query(querySpec).fetchAll();
        return resources;
    }

    async updateDocument(documentId: string, conversationId: string, updates: Partial<ConversationDocument>): Promise<ConversationDocument> {
        const { resource: existing } = await this.documentsContainer.item(documentId, conversationId).read();

        const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString(),
            version: (existing.version || 0) + 1
        };

        const { resource } = await this.documentsContainer.item(documentId, conversationId).replace(updated);
        return resource;
    }

    async updateMessage(conversationId: string, messageId: string, userId: string, updates: Partial<ConversationMessage>): Promise<ConversationMessage> {
        const { resource: message } = await this.messagesContainer.item(messageId, conversationId).read();
        if (!message) throw new Error("Message not found");

        const updated = {
            ...message,
            ...updates
        };

        const { resource } = await this.messagesContainer.item(messageId, conversationId).replace(updated);
        return resource;
    }

    async deleteAttachment(conversationId: string, messageId: string, attachmentId: string, userId: string): Promise<void> {
        const { resource: message } = await this.messagesContainer.item(messageId, conversationId).read();

        if (!message) {
            throw new Error(`Message ${messageId} not found`);
        }

        if (message.attachments) {
            const updatedAttachments = message.attachments.filter((a: any) => a.id !== attachmentId);

            await this.updateMessage(conversationId, messageId, userId, {
                attachments: updatedAttachments
            });
        }

        try {
            await this.documentsContainer.item(attachmentId, conversationId).delete();
        } catch (error: any) {
            if (error.code !== 404) {
                console.error(`Failed to delete document ${attachmentId}:`, error);
            }
        }
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}