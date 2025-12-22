
// Azure Cosmos DB Setup Script
// This script creates the database and containers with proper configuration

import { CosmosClient, PartitionKeyKind } from "@azure/cosmos";
import { CanvasBlock } from '../types';

/**
 * Azure Cosmos DB Schema Definitions
 */

// Main Conversation Container Schema
export interface Conversation {
    id: string;
    userId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
    metadata?: {
        tags?: string[];
        favorite?: boolean;
        archived?: boolean;
        model?: string;
        totalMessages?: number;
        totalTokens?: number;
    };
    canvasBlocks?: CanvasBlock[];
}

// Conversation Messages Container Schema
export interface ConversationMessage {
    id: string;
    conversationId: string;
    userId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    createdAt: string;
    sequenceNumber: number;
    metadata?: {
        tokenCount?: number;
        model?: string;
        finishReason?: string;
        latencyMs?: number;
    };
    attachments?: Array<{
        id: string;
        name: string;
        type: string;
        size: number;
        url?: string;
        documentId?: string;
    }>;
    toolCalls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        };
    }>;
    toolOutput?: any;
}

// Conversation Documents Container Schema
export interface ConversationDocument {
    id: string;
    conversationId: string;
    userId: string;
    messageId?: string;
    title: string;
    view: 'markdown' | 'code' | 'dashboard';
    createdAt: string;
    updatedAt: string;
    version: number;
    content?: string;
    language?: string;
    sourceLabel?: string;
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
    metadata?: {
        tags?: string[];
        shared?: boolean;
        exportedAt?: string;
        format?: string;
    };
}

/**
 * Database Setup Function
 * Run this once to create the database and containers
 */
export async function setupCosmosDB() {
    // Initialize Cosmos Client
    const endpoint = process.env.AZURE_COSMOS_ENDPOINT || '';
    const key = process.env.AZURE_COSMOS_KEY || '';

    if (!endpoint || !key) {
        throw new Error('AZURE_COSMOS_ENDPOINT and AZURE_COSMOS_KEY must be set in environment variables');
    }

    const client = new CosmosClient({ endpoint, key });

    console.log('Creating Cosmos DB database and containers...');

    try {
        // Create Database
        const { database } = await client.databases.createIfNotExists({
            id: 'ConversationDB'
        });
        console.log('✓ Database created: ConversationDB');

        // Create Conversations Container
        const { container: conversationsContainer } = await database.containers.createIfNotExists({
            id: 'conversations',
            partitionKey: {
                paths: ['/userId'],
                kind: PartitionKeyKind.Hash
            },
            indexingPolicy: {
                automatic: true,
                indexingMode: 'consistent',
                includedPaths: [
                    { path: '/*' }
                ],
                excludedPaths: [
                    { path: '/"_etag"/?' },
                    { path: '/canvasBlocks/*' }
                ]
            },
            defaultTtl: -1 // No automatic expiration
        });
        console.log('✓ Container created: conversations');

        // Create Messages Container
        const { container: messagesContainer } = await database.containers.createIfNotExists({
            id: 'messages',
            partitionKey: {
                paths: ['/conversationId'],
                kind: PartitionKeyKind.Hash
            },
            indexingPolicy: {
                automatic: true,
                indexingMode: 'consistent',
                includedPaths: [
                    { path: '/*' }
                ],
                excludedPaths: [
                    { path: '/content/?' },      // Exclude large content from indexing
                    { path: '/"_etag"/?' }
                ],
                compositeIndexes: [
                    [
                        { path: '/conversationId', order: 'ascending' },
                        { path: '/sequenceNumber', order: 'ascending' }
                    ],
                    [
                        { path: '/conversationId', order: 'ascending' },
                        { path: '/createdAt', order: 'descending' }
                    ]
                ]
            },
            defaultTtl: -1
        });
        console.log('✓ Container created: messages');

        // Create Documents Container
        const { container: documentsContainer } = await database.containers.createIfNotExists({
            id: 'documents',
            partitionKey: {
                paths: ['/conversationId'],
                kind: PartitionKeyKind.Hash
            },
            indexingPolicy: {
                automatic: true,
                indexingMode: 'consistent',
                includedPaths: [
                    { path: '/*' }
                ],
                excludedPaths: [
                    { path: '/content/?' },      // Exclude large content from indexing
                    { path: '/dashboardData/?' }, // Exclude complex nested data
                    { path: '/"_etag"/?' }
                ],
                compositeIndexes: [
                    [
                        { path: '/conversationId', order: 'ascending' },
                        { path: '/createdAt', order: 'descending' }
                    ]
                ]
            },
            defaultTtl: -1
        });
        console.log('✓ Container created: documents');

        console.log('\n✅ Cosmos DB setup completed successfully!');
        console.log('\nContainer Summary:');
        console.log('- conversations (partition key: /userId)');
        console.log('- messages (partition key: /conversationId)');
        console.log('- documents (partition key: /conversationId)');

        return { database, conversationsContainer, messagesContainer, documentsContainer };

    } catch (error) {
        console.error('❌ Error setting up Cosmos DB:', error);
        throw error;
    }
}