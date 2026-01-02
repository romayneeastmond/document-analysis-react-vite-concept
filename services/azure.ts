
import { AzureOpenAI } from "openai";
import { Agent, Message } from "../types";

const updateCanvas = {
	type: "function" as const,
	function: {
		name: "updateCanvas",
		description: "Generates structured content for the document. Use this to create detailed analysis, summaries, biographies, or structured data.",
		parameters: {
			type: "object",
			properties: {
				view: {
					type: "string",
					enum: ["markdown", "code", "dashboard"],
					description: "The type of view to render.",
				},
				title: {
					type: "string",
					description: "Title of the content.",
				},
				content: {
					type: "string",
					description: "Markdown content or Source code string. Required if view is markdown or code.",
				},
				language: {
					type: "string",
					description: "Programming language if view is code (e.g., 'typescript', 'python').",
				},
				sourceLabel: {
					type: "string",
					description: "A specific label indicating the source entity of the information. E.g., 'John Doe Sourced Biography'. Use this when providing information about specific people, services, or industries.",
				},
				dashboardData: {
					type: "object",
					description: "Structured data for the dashboard view. Required if view is dashboard.",
					properties: {
						title: { type: "string" },
						description: { type: "string" },
						stats: {
							type: "array",
							items: {
								type: "object",
								properties: {
									label: { type: "string" },
									value: { type: "string" },
									change: { type: "string" },
									positive: { type: "boolean" }
								}
							}
						},
						chartData: {
							type: "array",
							items: {
								type: "object",
								properties: {
									name: { type: "string" },
									value: { type: "number" },
									category: { type: "string" }
								}
							}
						}
					}
				}
			},
			required: ["view", "title"]
		},
	},
};

const functionToolDocumentExtraction = {
	type: "function" as const,
	function: {
		name: "documentExtraction",
		description: "Extracts text from attachments. Use this tool when the user asks to analyze, summarize, or extract information from uploaded documents.",
		parameters: {
			type: "object",
			properties: {
				guids: {
					type: "array",
					items: { type: "string" },
					description: "The list of attachment IDs (GUIDs) to analyze.",
				},
				filetypes: {
					type: "array",
					items: { type: "string" },
					description: "The list of file types/extensions corresponding to the guids.",
				}
			},
			required: ["guids", "filetypes"]
		},
	},
};

export class AzureOpenAIService {
	private client: AzureOpenAI;
	private deployment: string;
	private functionEndpointDocumentExtraction: string;
	public agents: Agent[];
	private mcpConnections: any[] = [];
	private currentFiles: any[] = [];
	private conversationId: string = "unknown";

	constructor() {
		const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
		const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
		const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || '';
		const functionEndpointDocumentExtraction = process.env.FUNCTION_DOCUMENT_ANALYSIS_ENDPOINT || '';

		if (!apiKey || !endpoint || !deployment) {
			console.warn("Azure OpenAI credentials (AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT) are missing from process.env");
		}

		this.client = new AzureOpenAI({
			apiKey,
			endpoint,
			apiVersion: "2024-05-01-preview",
			deployment,
			dangerouslyAllowBrowser: true
		});

		this.deployment = deployment;
		this.functionEndpointDocumentExtraction = functionEndpointDocumentExtraction;
	}

	public setAgents(agents: Agent[]) {
		this.agents = agents;
	}

	public setMcpConnections(connections: any[]) {
		this.mcpConnections = connections;
	}

	public setCurrentFiles(files: any[]) {
		this.currentFiles = files;
	}

	public setConversationId(id: string) {
		this.conversationId = id;
	}

	private getStandardToolsForOpenAI(): any[] {
		const activeTools: any[] = [updateCanvas];

		if (!this.agents) {
			return activeTools;
		}

		const standardTools = [
			{ id: 'documentExtraction', definition: functionToolDocumentExtraction },
		];

		for (const tool of standardTools) {
			const agent = this.agents.find(a => a.tool === tool.id);
			if (agent && agent.status === 'Active') {
				console.log(`Tool ${tool.id}: ACTIVE`);
				activeTools.push(tool.definition);
			} else {
				console.log(`Tool ${tool.id}: INACTIVE`);
			}
		}

		return activeTools;
	}

	private async callFunctionDocumentExtraction(guids: string[], filetypes: string[]): Promise<any> {
		try {
			const formData = new FormData();

			formData.append('guids', JSON.stringify(guids));
			formData.append('filetypes', JSON.stringify(filetypes));
			formData.append('conversationId', this.conversationId);

			if (this.currentFiles && this.currentFiles.length > 0) {
				const filesToUpload = this.currentFiles.filter(f => guids.includes(f.id));

				filesToUpload.forEach(f => {
					if (f.file) {
						formData.append('files', f.file);
					}
				});
			}

			const response = await fetch(this.functionEndpointDocumentExtraction, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error(`Function call to document_extraction responded with status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			throw error;
		}
	}

	async sendMessage(
		userMessage: string,
		currentHistory: Message[]
	): Promise<{ text: string, toolOutput?: any, rawToolOutput?: any }> {
		try {
			const formattedHistory = currentHistory.map(msg => {
				let content = msg.content;

				if (msg.role === 'model' && msg.canvasBlockData) {
					const toolName = msg.canvasBlockData.title || "Tool";
					content = `[Result: ${toolName}]\n${content}`;
				}

				return {
					role: (msg.role === 'model' ? 'assistant' : msg.role) as 'user' | 'assistant' | 'system',
					content: msg.attachments && msg.attachments.length > 0
						? `${content}\n[System Note: Message included attachments: ${msg.attachments.map(a => a.name).join(', ')}]`
						: content
				};
			});

			const availableTools = [
				...this.getStandardToolsForOpenAI(),
				...this.getMcpToolsForOpenAI()
			];

			const toolNames = availableTools.map(t => t.function.name);

			let capabilitiesSection = "";
			let sectionCount = 1;

			capabilitiesSection += `${sectionCount++}. Conversational Chat: Answer questions directly.\n`;

			if (toolNames.includes('updateCanvas')) {
				capabilitiesSection += `${sectionCount++}. Canvas Tools: Use 'updateCanvas' to GENERATE structured content like reports, summaries, or biographies.\n`;
			}

			const documentExtractionToolsInTurn = toolNames.filter(n => ['documentExtraction'].includes(n));

			if (documentExtractionToolsInTurn.length > 0) {
				capabilitiesSection += `${sectionCount++}. Document Extraction: Use 'documentExtraction' to extract information from documents.\n`;
			}

			const mcpToolsInTurn = this.getMcpToolsForOpenAI().map(t => t.function.name);

			if (mcpToolsInTurn.length > 0) {
				capabilitiesSection += `${sectionCount++}. External MCP Tools: Access specialized servers for: [${mcpToolsInTurn.join(', ')}].\n`;
			}

			const systemMessage = {
				role: "system" as const,
				content: `You are an advanced AI assistant specialized in document analysis and information retrieval.
		  
                You have multiple ways to help the user:
                ${capabilitiesSection}
                
                IMPORTANT:
                - ALWAYS provide a human-friendly summary or introduction in your regular text response.
                - CRITICAL: Never narrate what you are about to do. If you decide to call a tool, call it immediately in the same turn. Do NOT say "I will now call X" or "Please hold on while I fetch Y". Just call the tool.
                - If the user explicitly asks for a SPECIFIC tool (e.g., "Search for X"), you MUST use that tool. Do not substitute it with another tool.
                - If you used a tool previously and the user corrected you, do NOT repeat the same tool call. Acknowledge the error and use the tool they requested.
                - If you find yourself repeating the same tool call with the same parameters and getting the same result, STOP. Explain the situation to the user and ask for clarification instead of looping.
                - When you use 'updateCanvas', you are preparing content for the user. 
                - CRITICAL: NEVER include raw JSON data (e.g., [{}, {}] or {"key": "value"}) in the 'content' parameter of 'updateCanvas'. 
                - ALWAYS translate any data you find into a human-readable summary, professional report, or formatted Markdown list. The user wants to see insights, not technical data structures.
                - The structured tool data will be shown elegantly below your message, so focus on providing insights and a conversational overview in your regular text response.
                - Do NOT say "Click the preview" or similar; the data is already visible to the user.

                SPECIAL RULE FOR PEOPLE/ENTITIES:
                If the user asks "Who is [Person Name]?" or asks for a biography/profile of a specific person:
                1. Generate a professional biography/profile for them.
                2. Call 'updateCanvas'.
                3. Set 'view' to 'markdown'.
                4. CRITICAL: Put the FULL biography text (in Markdown format) into the 'content' parameter. Do not leave 'content' empty.
                5. CRITICAL: Set the 'sourceLabel' parameter to "[Person Name] Sourced Biography".
                `
			};

			const hasDocumentAnalysis = availableTools.some(t => t.function.name === 'documentExtraction');
			const shouldForceAnalysis = this.currentFiles && this.currentFiles.length > 0 && hasDocumentAnalysis;

			let response = await this.client.chat.completions.create({
				model: this.deployment,
				messages: [
					systemMessage,
					...formattedHistory,
					{ role: 'user', content: userMessage }
				],
				tools: availableTools.length > 0 ? availableTools : undefined,
				tool_choice: shouldForceAnalysis
					? { type: "function", function: { name: "documentExtraction" } }
					: "auto",
			});

			const choice = response.choices[0];


			if (!choice) {
				return { text: "No response generated." };
			}

			let textResponse = choice.message.content || "";
			let toolOutput = undefined;
			let rssFeedData = null;
			let rawToolOutput = undefined;

			if (choice.message.tool_calls) {
				const toolResults: any[] = [];

				for (const toolCall of choice.message.tool_calls) {
					if (toolCall.type === 'function') {
						if (toolCall.function.name === 'updateCanvas') {
							try {
								toolOutput = this.processUpdateCanvasArgs(toolCall.function.arguments);
							} catch (_error) {

							}
						} else if (toolCall.function.name === 'documentExtraction') {
							try {
								const inactiveAgent = this.agents.find(
									(agent: any) => agent.tool === 'documentExtraction' && agent.status === 'Inactive'
								);

								if (inactiveAgent) {
									textResponse = "Document Extraction is currently inactive.";
									throw new Error("Document extraction tool is currently inactive.");
								}

								const args = JSON.parse(toolCall.function.arguments);

								if (!args.guids || !Array.isArray(args.guids)) {
									throw new Error("Missing or invalid 'guids' parameter for documentExtraction");
								}
								if (!args.filetypes || !Array.isArray(args.filetypes)) {
									throw new Error("Missing or invalid 'filetypes' parameter for documentExtraction");
								}

								const documentExtractionData = await this.callFunctionDocumentExtraction(args.guids, args.filetypes);

								rawToolOutput = documentExtractionData;

								toolResults.push({
									tool_call_id: toolCall.id,
									role: "tool" as const,
									content: JSON.stringify(documentExtractionData)
								});
							} catch (error) {
								toolResults.push({
									tool_call_id: toolCall.id,
									role: "tool" as const,
									content: JSON.stringify({ error: error.message })
								});
							}
						} else {
							const mcpResult = await this.tryCallMcpTool(toolCall.function.name, toolCall.function.arguments);

							if (mcpResult) {
								rawToolOutput = mcpResult;

								if (!toolOutput) {
									const textContent = this.humanizeMcpResult(mcpResult);
									if (textContent) {
										toolOutput = {
											view: 'markdown',
											title: `${toolCall.function.name} Output`,
											content: textContent
										};
									}
								}

								toolResults.push({
									tool_call_id: toolCall.id,
									role: "tool" as const,
									content: mcpResult ? JSON.stringify(mcpResult) : `Error: Tool "${toolCall.function.name}" not found.`
								});
							}
						}
					}
				}

				if (toolResults.length > 0) {
					const followUpResponse = await this.client.chat.completions.create({
						model: this.deployment,
						messages: [
							systemMessage,
							...formattedHistory,
							{ role: 'user', content: userMessage },
							choice.message,
							...toolResults
						],
						tools: availableTools.length > 0 ? availableTools : undefined,
						tool_choice: "auto",
					});

					const followUpChoice = followUpResponse.choices[0];
					if (followUpChoice) {
						if (followUpChoice.message.content) {
							textResponse = followUpChoice.message.content;
						} else if (toolOutput || rssFeedData) {
							textResponse = "";
						}

						if (followUpChoice.message.tool_calls) {
							for (const toolCall of followUpChoice.message.tool_calls) {
								if (toolCall.type === 'function' && toolCall.function.name === 'updateCanvas') {
									try {
										toolOutput = this.processUpdateCanvasArgs(toolCall.function.arguments);
									} catch (_error) {
									}
								}
							}
						}
					}
				}
			}

			if (!textResponse.trim() && toolOutput) {
				textResponse = "";
			}

			return { text: textResponse || "I have processed your request.", toolOutput, rawToolOutput };
		} catch (_error) {
			return { text: "I encountered an error processing your request. Please check your API key and configuration." };
		}
	}

	private getMcpToolsForOpenAI(): any[] {
		const tools: any[] = [];
		if (!this.agents) return tools;

		for (const connection of this.mcpConnections) {
			if (connection.state === 'ready' && connection.tools) {
				let agent = this.agents.find(a => a.id == connection.agentId);

				if (!agent && connection.url) {
					const normalizedUrl = connection.url.replace(/\/$/, '').toLowerCase();

					agent = this.agents.find(a =>
						a.server && a.server.replace(/\/$/, '').toLowerCase() === normalizedUrl
					);
				}

				if (!agent) {
					continue;
				}

				if (agent.status !== 'Active') {
					continue;
				}

				const disabledList = agent.disabledTools || [];

				for (const tool of connection.tools) {
					if (disabledList.includes(tool.name)) {
						continue;
					}

					tools.push({
						type: "function",
						function: {
							name: tool.name,
							description: tool.description || `Call ${tool.name}`,
							parameters: tool.inputSchema
						}
					});
				}
			}
		}

		return tools;
	}

	private processUpdateCanvasArgs(argsString: string): any {
		const args = JSON.parse(argsString);

		if (args.content && typeof args.content === 'string') {
			const trimmed = args.content.trim();
			if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
				try {
					const parsed = JSON.parse(trimmed);
					args.content = this.humanizeMcpResult(parsed);
				} catch (e) {
				}
			}
		} else if (args.content && typeof args.content === 'object') {
			args.content = this.humanizeMcpResult(args.content);
		}

		return args;
	}

	private async tryCallMcpTool(name: string, argsString: string): Promise<any> {
		for (const connection of this.mcpConnections) {
			if (connection.state === 'ready') {
				const tool = connection.tools?.find((t: any) => t.name === name);
				if (tool) {
					try {
						const args = JSON.parse(argsString);

						let result;

						if (connection.client?.callTool) {
							result = await connection.client.callTool({
								name: name,
								arguments: args
							});
						} else if (connection.callTool) {
							result = await connection.callTool(name, args);
						} else {
							throw new Error(`Connection for ${name} has no callTool implementation`);
						}
						return result;
					} catch (e: any) {
						return { error: e.message };
					}
				}
			}
		}
		return null;
	}

	private humanizeMcpResult(data: any): string {
		if (!data) return "";

		const humanizeObject = (item: any): string => {
			if (!item || typeof item !== 'object') return String(item);

			const body = item.content || item.description || item.summary || item.text || item.value;
			const title = item.title || item.name || item.label || item.displayName;

			if (title && body) return `### ${title}\n${String(body)}`;
			if (body) return String(body);
			if (title) return `### ${title}`;

			return Object.entries(item)
				.filter(([k]) => !['id', '_id', 'uuid', 'url', 'categories', 'type'].includes(k))
				.map(([k, v]) => `**${k.charAt(0).toUpperCase() + k.slice(1)}**: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
				.join('\n');
		};

		if (data.content && Array.isArray(data.content)) {
			return data.content
				.filter((c: any) => c.type === 'text')
				.map((c: any) => c.text)
				.join('\n');
		}

		if (Array.isArray(data)) {
			return data.map(humanizeObject).join('\n\n---\n\n');
		}

		return humanizeObject(data);
	}
}