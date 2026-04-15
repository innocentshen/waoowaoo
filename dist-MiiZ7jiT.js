import { D as string, S as object, T as record, d as array, f as boolean, k as union, o as _enum, u as any, v as literal, x as number, y as looseObject } from "./types-aaRaCq1D.js";
import { f as TooManyEmbeddingValuesForCallError, m as UnsupportedFunctionalityError, o as InvalidPromptError, s as InvalidResponseDataError } from "./stream-B7dsfEFZ.js";
import { H as postFormDataToApi, U as postJsonToApi, V as parseProviderOptions, X as withUserAgentSuffix, Z as withoutTrailingSlash, a as combineHeaders, c as convertToBase64, f as createEventSourceResponseHandler, h as createJsonResponseHandler, j as isParsableJson, l as convertToFormData, m as createJsonErrorResponseHandler, o as convertBase64ToUint8Array, w as generateId, x as downloadBlob } from "./dist-DWBkLJID.js";
var defaultOpenAICompatibleErrorStructure = {
	errorSchema: object({ error: object({
		message: string(),
		type: string().nullish(),
		param: any().nullish(),
		code: union([string(), number()]).nullish()
	}) }),
	errorToMessage: (data) => data.error.message
};
function convertOpenAICompatibleChatUsage(usage) {
	var _a, _b, _c, _d, _e, _f;
	if (usage == null) return {
		inputTokens: {
			total: void 0,
			noCache: void 0,
			cacheRead: void 0,
			cacheWrite: void 0
		},
		outputTokens: {
			total: void 0,
			text: void 0,
			reasoning: void 0
		},
		raw: void 0
	};
	const promptTokens = (_a = usage.prompt_tokens) != null ? _a : 0;
	const completionTokens = (_b = usage.completion_tokens) != null ? _b : 0;
	const cacheReadTokens = (_d = (_c = usage.prompt_tokens_details) == null ? void 0 : _c.cached_tokens) != null ? _d : 0;
	const reasoningTokens = (_f = (_e = usage.completion_tokens_details) == null ? void 0 : _e.reasoning_tokens) != null ? _f : 0;
	return {
		inputTokens: {
			total: promptTokens,
			noCache: promptTokens - cacheReadTokens,
			cacheRead: cacheReadTokens,
			cacheWrite: void 0
		},
		outputTokens: {
			total: completionTokens,
			text: completionTokens - reasoningTokens,
			reasoning: reasoningTokens
		},
		raw: usage
	};
}
function getOpenAIMetadata(message) {
	var _a, _b;
	return (_b = (_a = message == null ? void 0 : message.providerOptions) == null ? void 0 : _a.openaiCompatible) != null ? _b : {};
}
function getAudioFormat(mediaType) {
	switch (mediaType) {
		case "audio/wav": return "wav";
		case "audio/mp3":
		case "audio/mpeg": return "mp3";
		default: return null;
	}
}
function convertToOpenAICompatibleChatMessages(prompt) {
	var _a, _b, _c;
	const messages = [];
	for (const { role, content, ...message } of prompt) {
		const metadata = getOpenAIMetadata({ ...message });
		switch (role) {
			case "system":
				messages.push({
					role: "system",
					content,
					...metadata
				});
				break;
			case "user":
				if (content.length === 1 && content[0].type === "text") {
					messages.push({
						role: "user",
						content: content[0].text,
						...getOpenAIMetadata(content[0])
					});
					break;
				}
				messages.push({
					role: "user",
					content: content.map((part) => {
						var _a2;
						const partMetadata = getOpenAIMetadata(part);
						switch (part.type) {
							case "text": return {
								type: "text",
								text: part.text,
								...partMetadata
							};
							case "file":
								if (part.mediaType.startsWith("image/")) {
									const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType;
									return {
										type: "image_url",
										image_url: { url: part.data instanceof URL ? part.data.toString() : `data:${mediaType};base64,${convertToBase64(part.data)}` },
										...partMetadata
									};
								}
								if (part.mediaType.startsWith("audio/")) {
									if (part.data instanceof URL) throw new UnsupportedFunctionalityError({ functionality: "audio file parts with URLs" });
									const format = getAudioFormat(part.mediaType);
									if (format === null) throw new UnsupportedFunctionalityError({ functionality: `audio media type ${part.mediaType}` });
									return {
										type: "input_audio",
										input_audio: {
											data: convertToBase64(part.data),
											format
										},
										...partMetadata
									};
								}
								if (part.mediaType === "application/pdf") {
									if (part.data instanceof URL) throw new UnsupportedFunctionalityError({ functionality: "PDF file parts with URLs" });
									return {
										type: "file",
										file: {
											filename: (_a2 = part.filename) != null ? _a2 : "document.pdf",
											file_data: `data:application/pdf;base64,${convertToBase64(part.data)}`
										},
										...partMetadata
									};
								}
								if (part.mediaType.startsWith("text/")) return {
									type: "text",
									text: part.data instanceof URL ? part.data.toString() : typeof part.data === "string" ? part.data : new TextDecoder().decode(part.data),
									...partMetadata
								};
								throw new UnsupportedFunctionalityError({ functionality: `file part media type ${part.mediaType}` });
						}
					}),
					...metadata
				});
				break;
			case "assistant": {
				let text = "";
				let reasoning = "";
				const toolCalls = [];
				for (const part of content) {
					const partMetadata = getOpenAIMetadata(part);
					switch (part.type) {
						case "text":
							text += part.text;
							break;
						case "reasoning":
							reasoning += part.text;
							break;
						case "tool-call": {
							const thoughtSignature = (_b = (_a = part.providerOptions) == null ? void 0 : _a.google) == null ? void 0 : _b.thoughtSignature;
							toolCalls.push({
								id: part.toolCallId,
								type: "function",
								function: {
									name: part.toolName,
									arguments: JSON.stringify(part.input)
								},
								...partMetadata,
								...thoughtSignature ? { extra_content: { google: { thought_signature: String(thoughtSignature) } } } : {}
							});
							break;
						}
					}
				}
				messages.push({
					role: "assistant",
					content: text,
					...reasoning.length > 0 ? { reasoning_content: reasoning } : {},
					tool_calls: toolCalls.length > 0 ? toolCalls : void 0,
					...metadata
				});
				break;
			}
			case "tool":
				for (const toolResponse of content) {
					if (toolResponse.type === "tool-approval-response") continue;
					const output = toolResponse.output;
					let contentValue;
					switch (output.type) {
						case "text":
						case "error-text":
							contentValue = output.value;
							break;
						case "execution-denied":
							contentValue = (_c = output.reason) != null ? _c : "Tool execution denied.";
							break;
						case "content":
						case "json":
						case "error-json":
							contentValue = JSON.stringify(output.value);
							break;
					}
					const toolResponseMetadata = getOpenAIMetadata(toolResponse);
					messages.push({
						role: "tool",
						tool_call_id: toolResponse.toolCallId,
						content: contentValue,
						...toolResponseMetadata
					});
				}
				break;
			default: {
				const _exhaustiveCheck = role;
				throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
			}
		}
	}
	return messages;
}
function getResponseMetadata({ id, model, created }) {
	return {
		id: id != null ? id : void 0,
		modelId: model != null ? model : void 0,
		timestamp: created != null ? /* @__PURE__ */ new Date(created * 1e3) : void 0
	};
}
function mapOpenAICompatibleFinishReason(finishReason) {
	switch (finishReason) {
		case "stop": return "stop";
		case "length": return "length";
		case "content_filter": return "content-filter";
		case "function_call":
		case "tool_calls": return "tool-calls";
		default: return "other";
	}
}
var openaiCompatibleLanguageModelChatOptions = object({
	user: string().optional(),
	reasoningEffort: string().optional(),
	textVerbosity: string().optional(),
	strictJsonSchema: boolean().optional()
});
function prepareTools({ tools, toolChoice }) {
	tools = (tools == null ? void 0 : tools.length) ? tools : void 0;
	const toolWarnings = [];
	if (tools == null) return {
		tools: void 0,
		toolChoice: void 0,
		toolWarnings
	};
	const openaiCompatTools = [];
	for (const tool of tools) if (tool.type === "provider") toolWarnings.push({
		type: "unsupported",
		feature: `provider-defined tool ${tool.id}`
	});
	else openaiCompatTools.push({
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.inputSchema,
			...tool.strict != null ? { strict: tool.strict } : {}
		}
	});
	if (toolChoice == null) return {
		tools: openaiCompatTools,
		toolChoice: void 0,
		toolWarnings
	};
	const type = toolChoice.type;
	switch (type) {
		case "auto":
		case "none":
		case "required": return {
			tools: openaiCompatTools,
			toolChoice: type,
			toolWarnings
		};
		case "tool": return {
			tools: openaiCompatTools,
			toolChoice: {
				type: "function",
				function: { name: toolChoice.toolName }
			},
			toolWarnings
		};
		default: throw new UnsupportedFunctionalityError({ functionality: `tool choice type: ${type}` });
	}
}
var OpenAICompatibleChatLanguageModel = class {
	constructor(modelId, config) {
		this.specificationVersion = "v3";
		var _a, _b;
		this.modelId = modelId;
		this.config = config;
		const errorStructure = (_a = config.errorStructure) != null ? _a : defaultOpenAICompatibleErrorStructure;
		this.chunkSchema = createOpenAICompatibleChatChunkSchema(errorStructure.errorSchema);
		this.failedResponseHandler = createJsonErrorResponseHandler(errorStructure);
		this.supportsStructuredOutputs = (_b = config.supportsStructuredOutputs) != null ? _b : false;
	}
	get provider() {
		return this.config.provider;
	}
	get providerOptionsName() {
		return this.config.provider.split(".")[0].trim();
	}
	get supportedUrls() {
		var _a, _b, _c;
		return (_c = (_b = (_a = this.config).supportedUrls) == null ? void 0 : _b.call(_a)) != null ? _c : {};
	}
	transformRequestBody(args) {
		var _a, _b, _c;
		return (_c = (_b = (_a = this.config).transformRequestBody) == null ? void 0 : _b.call(_a, args)) != null ? _c : args;
	}
	async getArgs({ prompt, maxOutputTokens, temperature, topP, topK, frequencyPenalty, presencePenalty, providerOptions, stopSequences, responseFormat, seed, toolChoice, tools }) {
		var _a, _b, _c, _d, _e;
		const warnings = [];
		const deprecatedOptions = await parseProviderOptions({
			provider: "openai-compatible",
			providerOptions,
			schema: openaiCompatibleLanguageModelChatOptions
		});
		if (deprecatedOptions != null) warnings.push({
			type: "other",
			message: `The 'openai-compatible' key in providerOptions is deprecated. Use 'openaiCompatible' instead.`
		});
		const compatibleOptions = Object.assign(deprecatedOptions != null ? deprecatedOptions : {}, (_a = await parseProviderOptions({
			provider: "openaiCompatible",
			providerOptions,
			schema: openaiCompatibleLanguageModelChatOptions
		})) != null ? _a : {}, (_b = await parseProviderOptions({
			provider: this.providerOptionsName,
			providerOptions,
			schema: openaiCompatibleLanguageModelChatOptions
		})) != null ? _b : {});
		const strictJsonSchema = (_c = compatibleOptions == null ? void 0 : compatibleOptions.strictJsonSchema) != null ? _c : true;
		if (topK != null) warnings.push({
			type: "unsupported",
			feature: "topK"
		});
		if ((responseFormat == null ? void 0 : responseFormat.type) === "json" && responseFormat.schema != null && !this.supportsStructuredOutputs) warnings.push({
			type: "unsupported",
			feature: "responseFormat",
			details: "JSON response format schema is only supported with structuredOutputs"
		});
		const { tools: openaiTools, toolChoice: openaiToolChoice, toolWarnings } = prepareTools({
			tools,
			toolChoice
		});
		return {
			args: {
				model: this.modelId,
				user: compatibleOptions.user,
				max_tokens: maxOutputTokens,
				temperature,
				top_p: topP,
				frequency_penalty: frequencyPenalty,
				presence_penalty: presencePenalty,
				response_format: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? this.supportsStructuredOutputs === true && responseFormat.schema != null ? {
					type: "json_schema",
					json_schema: {
						schema: responseFormat.schema,
						strict: strictJsonSchema,
						name: (_d = responseFormat.name) != null ? _d : "response",
						description: responseFormat.description
					}
				} : { type: "json_object" } : void 0,
				stop: stopSequences,
				seed,
				...Object.fromEntries(Object.entries((_e = providerOptions == null ? void 0 : providerOptions[this.providerOptionsName]) != null ? _e : {}).filter(([key]) => !Object.keys(openaiCompatibleLanguageModelChatOptions.shape).includes(key))),
				reasoning_effort: compatibleOptions.reasoningEffort,
				verbosity: compatibleOptions.textVerbosity,
				messages: convertToOpenAICompatibleChatMessages(prompt),
				tools: openaiTools,
				tool_choice: openaiToolChoice
			},
			warnings: [...warnings, ...toolWarnings]
		};
	}
	async doGenerate(options) {
		var _a, _b, _c, _d, _e, _f, _g, _h;
		const { args, warnings } = await this.getArgs({ ...options });
		const transformedBody = this.transformRequestBody(args);
		const body = JSON.stringify(transformedBody);
		const { responseHeaders, value: responseBody, rawValue: rawResponse } = await postJsonToApi({
			url: this.config.url({
				path: "/chat/completions",
				modelId: this.modelId
			}),
			headers: combineHeaders(this.config.headers(), options.headers),
			body: transformedBody,
			failedResponseHandler: this.failedResponseHandler,
			successfulResponseHandler: createJsonResponseHandler(OpenAICompatibleChatResponseSchema),
			abortSignal: options.abortSignal,
			fetch: this.config.fetch
		});
		const choice = responseBody.choices[0];
		const content = [];
		const text = choice.message.content;
		if (text != null && text.length > 0) content.push({
			type: "text",
			text
		});
		const reasoning = (_a = choice.message.reasoning_content) != null ? _a : choice.message.reasoning;
		if (reasoning != null && reasoning.length > 0) content.push({
			type: "reasoning",
			text: reasoning
		});
		if (choice.message.images) for (const image of choice.message.images) {
			const match1 = image.image_url.url.match(/^data:([^;]+)/);
			const match2 = image.image_url.url.match(/^data:[^;]*;base64,(.+)$/);
			content.push({
				type: "file",
				mediaType: match1 ? match1[1] ?? "image/jpeg" : "image/jpeg",
				data: match2 ? match2[1] : image.image_url.url
			});
		}
		if (choice.message.tool_calls != null) for (const toolCall of choice.message.tool_calls) {
			const thoughtSignature = (_c = (_b = toolCall.extra_content) == null ? void 0 : _b.google) == null ? void 0 : _c.thought_signature;
			content.push({
				type: "tool-call",
				toolCallId: (_d = toolCall.id) != null ? _d : generateId(),
				toolName: toolCall.function.name,
				input: toolCall.function.arguments,
				...thoughtSignature ? { providerMetadata: { [this.providerOptionsName]: { thoughtSignature } } } : {}
			});
		}
		const providerMetadata = {
			[this.providerOptionsName]: {},
			...await ((_f = (_e = this.config.metadataExtractor) == null ? void 0 : _e.extractMetadata) == null ? void 0 : _f.call(_e, { parsedBody: rawResponse }))
		};
		const completionTokenDetails = (_g = responseBody.usage) == null ? void 0 : _g.completion_tokens_details;
		if ((completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens) != null) providerMetadata[this.providerOptionsName].acceptedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens;
		if ((completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens) != null) providerMetadata[this.providerOptionsName].rejectedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens;
		return {
			content,
			finishReason: {
				unified: mapOpenAICompatibleFinishReason(choice.finish_reason),
				raw: (_h = choice.finish_reason) != null ? _h : void 0
			},
			usage: convertOpenAICompatibleChatUsage(responseBody.usage),
			providerMetadata,
			request: { body },
			response: {
				...getResponseMetadata(responseBody),
				headers: responseHeaders,
				body: rawResponse
			},
			warnings
		};
	}
	async doStream(options) {
		var _a;
		const { args, warnings } = await this.getArgs({ ...options });
		const body = this.transformRequestBody({
			...args,
			stream: true,
			stream_options: this.config.includeUsage ? { include_usage: true } : void 0
		});
		const metadataExtractor = (_a = this.config.metadataExtractor) == null ? void 0 : _a.createStreamExtractor();
		const { responseHeaders, value: response } = await postJsonToApi({
			url: this.config.url({
				path: "/chat/completions",
				modelId: this.modelId
			}),
			headers: combineHeaders(this.config.headers(), options.headers),
			body,
			failedResponseHandler: this.failedResponseHandler,
			successfulResponseHandler: createEventSourceResponseHandler(this.chunkSchema),
			abortSignal: options.abortSignal,
			fetch: this.config.fetch
		});
		const toolCalls = [];
		let finishReason = {
			unified: "other",
			raw: void 0
		};
		let usage = void 0;
		let isFirstChunk = true;
		const providerOptionsName = this.providerOptionsName;
		let isActiveReasoning = false;
		let isActiveText = false;
		return {
			stream: response.pipeThrough(new TransformStream({
				start(controller) {
					controller.enqueue({
						type: "stream-start",
						warnings
					});
				},
				transform(chunk, controller) {
					var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
					if (options.includeRawChunks) controller.enqueue({
						type: "raw",
						rawValue: chunk.rawValue
					});
					if (!chunk.success) {
						finishReason = {
							unified: "error",
							raw: void 0
						};
						controller.enqueue({
							type: "error",
							error: chunk.error
						});
						return;
					}
					metadataExtractor?.processChunk(chunk.rawValue);
					if ("error" in chunk.value) {
						finishReason = {
							unified: "error",
							raw: void 0
						};
						controller.enqueue({
							type: "error",
							error: chunk.value.error.message
						});
						return;
					}
					const value = chunk.value;
					if (isFirstChunk) {
						isFirstChunk = false;
						controller.enqueue({
							type: "response-metadata",
							...getResponseMetadata(value)
						});
					}
					if (value.usage != null) usage = value.usage;
					const choice = value.choices[0];
					if ((choice == null ? void 0 : choice.finish_reason) != null) finishReason = {
						unified: mapOpenAICompatibleFinishReason(choice.finish_reason),
						raw: (_a2 = choice.finish_reason) != null ? _a2 : void 0
					};
					if ((choice == null ? void 0 : choice.delta) == null) return;
					const delta = choice.delta;
					const reasoningContent = (_b = delta.reasoning_content) != null ? _b : delta.reasoning;
					if (reasoningContent) {
						if (!isActiveReasoning) {
							controller.enqueue({
								type: "reasoning-start",
								id: "reasoning-0"
							});
							isActiveReasoning = true;
						}
						controller.enqueue({
							type: "reasoning-delta",
							id: "reasoning-0",
							delta: reasoningContent
						});
					}
					if (delta.content) {
						if (isActiveReasoning) {
							controller.enqueue({
								type: "reasoning-end",
								id: "reasoning-0"
							});
							isActiveReasoning = false;
						}
						if (!isActiveText) {
							controller.enqueue({
								type: "text-start",
								id: "txt-0"
							});
							isActiveText = true;
						}
						controller.enqueue({
							type: "text-delta",
							id: "txt-0",
							delta: delta.content
						});
					}
					if (delta.images) for (const image of delta.images) {
						const match1 = image.image_url.url.match(/^data:([^;]+)/);
						const match2 = image.image_url.url.match(/^data:[^;]*;base64,(.+)$/);
						controller.enqueue({
							type: "file",
							mediaType: match1 ? match1[1] ?? "image/jpeg" : "image/jpeg",
							data: match2 ? match2[1] : image.image_url.url
						});
					}
					if (delta.tool_calls != null) {
						if (isActiveReasoning) {
							controller.enqueue({
								type: "reasoning-end",
								id: "reasoning-0"
							});
							isActiveReasoning = false;
						}
						for (const toolCallDelta of delta.tool_calls) {
							const index = (_c = toolCallDelta.index) != null ? _c : toolCalls.length;
							if (toolCalls[index] == null) {
								if (toolCallDelta.id == null) throw new InvalidResponseDataError({
									data: toolCallDelta,
									message: `Expected 'id' to be a string.`
								});
								if (((_d = toolCallDelta.function) == null ? void 0 : _d.name) == null) throw new InvalidResponseDataError({
									data: toolCallDelta,
									message: `Expected 'function.name' to be a string.`
								});
								controller.enqueue({
									type: "tool-input-start",
									id: toolCallDelta.id,
									toolName: toolCallDelta.function.name
								});
								toolCalls[index] = {
									id: toolCallDelta.id,
									type: "function",
									function: {
										name: toolCallDelta.function.name,
										arguments: (_e = toolCallDelta.function.arguments) != null ? _e : ""
									},
									hasFinished: false,
									thoughtSignature: (_h = (_g = (_f = toolCallDelta.extra_content) == null ? void 0 : _f.google) == null ? void 0 : _g.thought_signature) != null ? _h : void 0
								};
								const toolCall2 = toolCalls[index];
								if (((_i = toolCall2.function) == null ? void 0 : _i.name) != null && ((_j = toolCall2.function) == null ? void 0 : _j.arguments) != null) {
									if (toolCall2.function.arguments.length > 0) controller.enqueue({
										type: "tool-input-delta",
										id: toolCall2.id,
										delta: toolCall2.function.arguments
									});
									if (isParsableJson(toolCall2.function.arguments)) {
										controller.enqueue({
											type: "tool-input-end",
											id: toolCall2.id
										});
										controller.enqueue({
											type: "tool-call",
											toolCallId: (_k = toolCall2.id) != null ? _k : generateId(),
											toolName: toolCall2.function.name,
											input: toolCall2.function.arguments,
											...toolCall2.thoughtSignature ? { providerMetadata: { [providerOptionsName]: { thoughtSignature: toolCall2.thoughtSignature } } } : {}
										});
										toolCall2.hasFinished = true;
									}
								}
								continue;
							}
							const toolCall = toolCalls[index];
							if (toolCall.hasFinished) continue;
							if (((_l = toolCallDelta.function) == null ? void 0 : _l.arguments) != null) toolCall.function.arguments += (_n = (_m = toolCallDelta.function) == null ? void 0 : _m.arguments) != null ? _n : "";
							controller.enqueue({
								type: "tool-input-delta",
								id: toolCall.id,
								delta: (_o = toolCallDelta.function.arguments) != null ? _o : ""
							});
							if (((_p = toolCall.function) == null ? void 0 : _p.name) != null && ((_q = toolCall.function) == null ? void 0 : _q.arguments) != null && isParsableJson(toolCall.function.arguments)) {
								controller.enqueue({
									type: "tool-input-end",
									id: toolCall.id
								});
								controller.enqueue({
									type: "tool-call",
									toolCallId: (_r = toolCall.id) != null ? _r : generateId(),
									toolName: toolCall.function.name,
									input: toolCall.function.arguments,
									...toolCall.thoughtSignature ? { providerMetadata: { [providerOptionsName]: { thoughtSignature: toolCall.thoughtSignature } } } : {}
								});
								toolCall.hasFinished = true;
							}
						}
					}
				},
				flush(controller) {
					var _a2, _b, _c, _d, _e;
					if (isActiveReasoning) controller.enqueue({
						type: "reasoning-end",
						id: "reasoning-0"
					});
					if (isActiveText) controller.enqueue({
						type: "text-end",
						id: "txt-0"
					});
					for (const toolCall of toolCalls.filter((toolCall2) => !toolCall2.hasFinished)) {
						controller.enqueue({
							type: "tool-input-end",
							id: toolCall.id
						});
						controller.enqueue({
							type: "tool-call",
							toolCallId: (_a2 = toolCall.id) != null ? _a2 : generateId(),
							toolName: toolCall.function.name,
							input: toolCall.function.arguments,
							...toolCall.thoughtSignature ? { providerMetadata: { [providerOptionsName]: { thoughtSignature: toolCall.thoughtSignature } } } : {}
						});
					}
					const providerMetadata = {
						[providerOptionsName]: {},
						...metadataExtractor == null ? void 0 : metadataExtractor.buildMetadata()
					};
					if (((_b = usage == null ? void 0 : usage.completion_tokens_details) == null ? void 0 : _b.accepted_prediction_tokens) != null) providerMetadata[providerOptionsName].acceptedPredictionTokens = (_c = usage == null ? void 0 : usage.completion_tokens_details) == null ? void 0 : _c.accepted_prediction_tokens;
					if (((_d = usage == null ? void 0 : usage.completion_tokens_details) == null ? void 0 : _d.rejected_prediction_tokens) != null) providerMetadata[providerOptionsName].rejectedPredictionTokens = (_e = usage == null ? void 0 : usage.completion_tokens_details) == null ? void 0 : _e.rejected_prediction_tokens;
					controller.enqueue({
						type: "finish",
						finishReason,
						usage: convertOpenAICompatibleChatUsage(usage),
						providerMetadata
					});
				}
			})),
			request: { body },
			response: { headers: responseHeaders }
		};
	}
};
var openaiCompatibleTokenUsageSchema = looseObject({
	prompt_tokens: number().nullish(),
	completion_tokens: number().nullish(),
	total_tokens: number().nullish(),
	prompt_tokens_details: object({ cached_tokens: number().nullish() }).nullish(),
	completion_tokens_details: object({
		reasoning_tokens: number().nullish(),
		accepted_prediction_tokens: number().nullish(),
		rejected_prediction_tokens: number().nullish()
	}).nullish()
}).nullish();
var OpenAICompatibleChatResponseSchema = looseObject({
	id: string().nullish(),
	created: number().nullish(),
	model: string().nullish(),
	choices: array(object({
		message: object({
			role: literal("assistant").nullish(),
			content: string().nullish(),
			reasoning_content: string().nullish(),
			reasoning: string().nullish(),
			tool_calls: array(object({
				id: string().nullish(),
				function: object({
					name: string(),
					arguments: string()
				}),
				extra_content: object({ google: object({ thought_signature: string().nullish() }).nullish() }).nullish()
			})).nullish(),
			images: array(object({
				type: literal("image_url"),
				image_url: object({ url: string() })
			})).nullish()
		}),
		finish_reason: string().nullish()
	})),
	usage: openaiCompatibleTokenUsageSchema
});
var chunkBaseSchema = looseObject({
	id: string().nullish(),
	created: number().nullish(),
	model: string().nullish(),
	choices: array(object({
		delta: object({
			role: _enum(["assistant"]).nullish(),
			content: string().nullish(),
			reasoning_content: string().nullish(),
			reasoning: string().nullish(),
			tool_calls: array(object({
				index: number().nullish(),
				id: string().nullish(),
				function: object({
					name: string().nullish(),
					arguments: string().nullish()
				}),
				extra_content: object({ google: object({ thought_signature: string().nullish() }).nullish() }).nullish()
			})).nullish(),
			images: array(object({
				type: literal("image_url"),
				image_url: object({ url: string() })
			})).nullish()
		}).nullish(),
		finish_reason: string().nullish()
	})),
	usage: openaiCompatibleTokenUsageSchema
});
var createOpenAICompatibleChatChunkSchema = (errorSchema) => union([chunkBaseSchema, errorSchema]);
function convertOpenAICompatibleCompletionUsage(usage) {
	var _a, _b;
	if (usage == null) return {
		inputTokens: {
			total: void 0,
			noCache: void 0,
			cacheRead: void 0,
			cacheWrite: void 0
		},
		outputTokens: {
			total: void 0,
			text: void 0,
			reasoning: void 0
		},
		raw: void 0
	};
	const promptTokens = (_a = usage.prompt_tokens) != null ? _a : 0;
	const completionTokens = (_b = usage.completion_tokens) != null ? _b : 0;
	return {
		inputTokens: {
			total: promptTokens,
			noCache: promptTokens,
			cacheRead: void 0,
			cacheWrite: void 0
		},
		outputTokens: {
			total: completionTokens,
			text: completionTokens,
			reasoning: void 0
		},
		raw: usage
	};
}
function convertToOpenAICompatibleCompletionPrompt({ prompt, user = "user", assistant = "assistant" }) {
	let text = "";
	if (prompt[0].role === "system") {
		text += `${prompt[0].content}

`;
		prompt = prompt.slice(1);
	}
	for (const { role, content } of prompt) switch (role) {
		case "system": throw new InvalidPromptError({
			message: "Unexpected system message in prompt: ${content}",
			prompt
		});
		case "user": {
			const userMessage = content.map((part) => {
				switch (part.type) {
					case "text": return part.text;
				}
			}).filter(Boolean).join("");
			text += `${user}:
${userMessage}

`;
			break;
		}
		case "assistant": {
			const assistantMessage = content.map((part) => {
				switch (part.type) {
					case "text": return part.text;
					case "tool-call": throw new UnsupportedFunctionalityError({ functionality: "tool-call messages" });
				}
			}).join("");
			text += `${assistant}:
${assistantMessage}

`;
			break;
		}
		case "tool": throw new UnsupportedFunctionalityError({ functionality: "tool messages" });
		default: {
			const _exhaustiveCheck = role;
			throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
		}
	}
	text += `${assistant}:
`;
	return {
		prompt: text,
		stopSequences: [`
${user}:`]
	};
}
function getResponseMetadata2({ id, model, created }) {
	return {
		id: id != null ? id : void 0,
		modelId: model != null ? model : void 0,
		timestamp: created != null ? /* @__PURE__ */ new Date(created * 1e3) : void 0
	};
}
function mapOpenAICompatibleFinishReason2(finishReason) {
	switch (finishReason) {
		case "stop": return "stop";
		case "length": return "length";
		case "content_filter": return "content-filter";
		case "function_call":
		case "tool_calls": return "tool-calls";
		default: return "other";
	}
}
var openaiCompatibleLanguageModelCompletionOptions = object({
	echo: boolean().optional(),
	logitBias: record(string(), number()).optional(),
	suffix: string().optional(),
	user: string().optional()
});
var OpenAICompatibleCompletionLanguageModel = class {
	constructor(modelId, config) {
		this.specificationVersion = "v3";
		var _a;
		this.modelId = modelId;
		this.config = config;
		const errorStructure = (_a = config.errorStructure) != null ? _a : defaultOpenAICompatibleErrorStructure;
		this.chunkSchema = createOpenAICompatibleCompletionChunkSchema(errorStructure.errorSchema);
		this.failedResponseHandler = createJsonErrorResponseHandler(errorStructure);
	}
	get provider() {
		return this.config.provider;
	}
	get providerOptionsName() {
		return this.config.provider.split(".")[0].trim();
	}
	get supportedUrls() {
		var _a, _b, _c;
		return (_c = (_b = (_a = this.config).supportedUrls) == null ? void 0 : _b.call(_a)) != null ? _c : {};
	}
	async getArgs({ prompt, maxOutputTokens, temperature, topP, topK, frequencyPenalty, presencePenalty, stopSequences: userStopSequences, responseFormat, seed, providerOptions, tools, toolChoice }) {
		var _a;
		const warnings = [];
		const completionOptions = (_a = await parseProviderOptions({
			provider: this.providerOptionsName,
			providerOptions,
			schema: openaiCompatibleLanguageModelCompletionOptions
		})) != null ? _a : {};
		if (topK != null) warnings.push({
			type: "unsupported",
			feature: "topK"
		});
		if (tools == null ? void 0 : tools.length) warnings.push({
			type: "unsupported",
			feature: "tools"
		});
		if (toolChoice != null) warnings.push({
			type: "unsupported",
			feature: "toolChoice"
		});
		if (responseFormat != null && responseFormat.type !== "text") warnings.push({
			type: "unsupported",
			feature: "responseFormat",
			details: "JSON response format is not supported."
		});
		const { prompt: completionPrompt, stopSequences } = convertToOpenAICompatibleCompletionPrompt({ prompt });
		const stop = [...stopSequences != null ? stopSequences : [], ...userStopSequences != null ? userStopSequences : []];
		return {
			args: {
				model: this.modelId,
				echo: completionOptions.echo,
				logit_bias: completionOptions.logitBias,
				suffix: completionOptions.suffix,
				user: completionOptions.user,
				max_tokens: maxOutputTokens,
				temperature,
				top_p: topP,
				frequency_penalty: frequencyPenalty,
				presence_penalty: presencePenalty,
				seed,
				...providerOptions == null ? void 0 : providerOptions[this.providerOptionsName],
				prompt: completionPrompt,
				stop: stop.length > 0 ? stop : void 0
			},
			warnings
		};
	}
	async doGenerate(options) {
		const { args, warnings } = await this.getArgs(options);
		const { responseHeaders, value: response, rawValue: rawResponse } = await postJsonToApi({
			url: this.config.url({
				path: "/completions",
				modelId: this.modelId
			}),
			headers: combineHeaders(this.config.headers(), options.headers),
			body: args,
			failedResponseHandler: this.failedResponseHandler,
			successfulResponseHandler: createJsonResponseHandler(openaiCompatibleCompletionResponseSchema),
			abortSignal: options.abortSignal,
			fetch: this.config.fetch
		});
		const choice = response.choices[0];
		const content = [];
		if (choice.text != null && choice.text.length > 0) content.push({
			type: "text",
			text: choice.text
		});
		return {
			content,
			usage: convertOpenAICompatibleCompletionUsage(response.usage),
			finishReason: {
				unified: mapOpenAICompatibleFinishReason2(choice.finish_reason),
				raw: choice.finish_reason
			},
			request: { body: args },
			response: {
				...getResponseMetadata2(response),
				headers: responseHeaders,
				body: rawResponse
			},
			warnings
		};
	}
	async doStream(options) {
		const { args, warnings } = await this.getArgs(options);
		const body = {
			...args,
			stream: true,
			stream_options: this.config.includeUsage ? { include_usage: true } : void 0
		};
		const { responseHeaders, value: response } = await postJsonToApi({
			url: this.config.url({
				path: "/completions",
				modelId: this.modelId
			}),
			headers: combineHeaders(this.config.headers(), options.headers),
			body,
			failedResponseHandler: this.failedResponseHandler,
			successfulResponseHandler: createEventSourceResponseHandler(this.chunkSchema),
			abortSignal: options.abortSignal,
			fetch: this.config.fetch
		});
		let finishReason = {
			unified: "other",
			raw: void 0
		};
		let usage = void 0;
		let isFirstChunk = true;
		return {
			stream: response.pipeThrough(new TransformStream({
				start(controller) {
					controller.enqueue({
						type: "stream-start",
						warnings
					});
				},
				transform(chunk, controller) {
					var _a;
					if (options.includeRawChunks) controller.enqueue({
						type: "raw",
						rawValue: chunk.rawValue
					});
					if (!chunk.success) {
						finishReason = {
							unified: "error",
							raw: void 0
						};
						controller.enqueue({
							type: "error",
							error: chunk.error
						});
						return;
					}
					const value = chunk.value;
					if ("error" in value) {
						finishReason = {
							unified: "error",
							raw: void 0
						};
						controller.enqueue({
							type: "error",
							error: value.error
						});
						return;
					}
					if (isFirstChunk) {
						isFirstChunk = false;
						controller.enqueue({
							type: "response-metadata",
							...getResponseMetadata2(value)
						});
						controller.enqueue({
							type: "text-start",
							id: "0"
						});
					}
					if (value.usage != null) usage = value.usage;
					const choice = value.choices[0];
					if ((choice == null ? void 0 : choice.finish_reason) != null) finishReason = {
						unified: mapOpenAICompatibleFinishReason2(choice.finish_reason),
						raw: (_a = choice.finish_reason) != null ? _a : void 0
					};
					if ((choice == null ? void 0 : choice.text) != null) controller.enqueue({
						type: "text-delta",
						id: "0",
						delta: choice.text
					});
				},
				flush(controller) {
					if (!isFirstChunk) controller.enqueue({
						type: "text-end",
						id: "0"
					});
					controller.enqueue({
						type: "finish",
						finishReason,
						usage: convertOpenAICompatibleCompletionUsage(usage)
					});
				}
			})),
			request: { body },
			response: { headers: responseHeaders }
		};
	}
};
var usageSchema = object({
	prompt_tokens: number(),
	completion_tokens: number(),
	total_tokens: number()
});
var openaiCompatibleCompletionResponseSchema = object({
	id: string().nullish(),
	created: number().nullish(),
	model: string().nullish(),
	choices: array(object({
		text: string(),
		finish_reason: string()
	})),
	usage: usageSchema.nullish()
});
var createOpenAICompatibleCompletionChunkSchema = (errorSchema) => union([object({
	id: string().nullish(),
	created: number().nullish(),
	model: string().nullish(),
	choices: array(object({
		text: string(),
		finish_reason: string().nullish(),
		index: number()
	})),
	usage: usageSchema.nullish()
}), errorSchema]);
var openaiCompatibleEmbeddingModelOptions = object({
	dimensions: number().optional(),
	user: string().optional()
});
var OpenAICompatibleEmbeddingModel = class {
	constructor(modelId, config) {
		this.specificationVersion = "v3";
		this.modelId = modelId;
		this.config = config;
	}
	get provider() {
		return this.config.provider;
	}
	get maxEmbeddingsPerCall() {
		var _a;
		return (_a = this.config.maxEmbeddingsPerCall) != null ? _a : 2048;
	}
	get supportsParallelCalls() {
		var _a;
		return (_a = this.config.supportsParallelCalls) != null ? _a : true;
	}
	get providerOptionsName() {
		return this.config.provider.split(".")[0].trim();
	}
	async doEmbed({ values, headers, abortSignal, providerOptions }) {
		var _a, _b, _c;
		const warnings = [];
		const deprecatedOptions = await parseProviderOptions({
			provider: "openai-compatible",
			providerOptions,
			schema: openaiCompatibleEmbeddingModelOptions
		});
		if (deprecatedOptions != null) warnings.push({
			type: "other",
			message: `The 'openai-compatible' key in providerOptions is deprecated. Use 'openaiCompatible' instead.`
		});
		const compatibleOptions = Object.assign(deprecatedOptions != null ? deprecatedOptions : {}, (_a = await parseProviderOptions({
			provider: "openaiCompatible",
			providerOptions,
			schema: openaiCompatibleEmbeddingModelOptions
		})) != null ? _a : {}, (_b = await parseProviderOptions({
			provider: this.providerOptionsName,
			providerOptions,
			schema: openaiCompatibleEmbeddingModelOptions
		})) != null ? _b : {});
		if (values.length > this.maxEmbeddingsPerCall) throw new TooManyEmbeddingValuesForCallError({
			provider: this.provider,
			modelId: this.modelId,
			maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
			values
		});
		const { responseHeaders, value: response, rawValue } = await postJsonToApi({
			url: this.config.url({
				path: "/embeddings",
				modelId: this.modelId
			}),
			headers: combineHeaders(this.config.headers(), headers),
			body: {
				model: this.modelId,
				input: values,
				encoding_format: "float",
				dimensions: compatibleOptions.dimensions,
				user: compatibleOptions.user
			},
			failedResponseHandler: createJsonErrorResponseHandler((_c = this.config.errorStructure) != null ? _c : defaultOpenAICompatibleErrorStructure),
			successfulResponseHandler: createJsonResponseHandler(openaiTextEmbeddingResponseSchema),
			abortSignal,
			fetch: this.config.fetch
		});
		return {
			warnings,
			embeddings: response.data.map((item) => item.embedding),
			usage: response.usage ? { tokens: response.usage.prompt_tokens } : void 0,
			providerMetadata: response.providerMetadata,
			response: {
				headers: responseHeaders,
				body: rawValue
			}
		};
	}
};
var openaiTextEmbeddingResponseSchema = object({
	data: array(object({ embedding: array(number()) })),
	usage: object({ prompt_tokens: number() }).nullish(),
	providerMetadata: record(string(), record(string(), any())).optional()
});
var OpenAICompatibleImageModel = class {
	constructor(modelId, config) {
		this.modelId = modelId;
		this.config = config;
		this.specificationVersion = "v3";
		this.maxImagesPerCall = 10;
	}
	get provider() {
		return this.config.provider;
	}
	get providerOptionsKey() {
		return this.config.provider.split(".")[0].trim();
	}
	getArgs(providerOptions) {
		return {
			...providerOptions[this.providerOptionsKey],
			...providerOptions[toCamelCase(this.providerOptionsKey)]
		};
	}
	async doGenerate({ prompt, n, size, aspectRatio, seed, providerOptions, headers, abortSignal, files, mask }) {
		var _a, _b, _c, _d, _e;
		const warnings = [];
		if (aspectRatio != null) warnings.push({
			type: "unsupported",
			feature: "aspectRatio",
			details: "This model does not support aspect ratio. Use `size` instead."
		});
		if (seed != null) warnings.push({
			type: "unsupported",
			feature: "seed"
		});
		const currentDate = (_c = (_b = (_a = this.config._internal) == null ? void 0 : _a.currentDate) == null ? void 0 : _b.call(_a)) != null ? _c : /* @__PURE__ */ new Date();
		const args = this.getArgs(providerOptions);
		if (files != null && files.length > 0) {
			const { value: response2, responseHeaders: responseHeaders2 } = await postFormDataToApi({
				url: this.config.url({
					path: "/images/edits",
					modelId: this.modelId
				}),
				headers: combineHeaders(this.config.headers(), headers),
				formData: convertToFormData({
					model: this.modelId,
					prompt,
					image: await Promise.all(files.map((file) => fileToBlob(file))),
					mask: mask != null ? await fileToBlob(mask) : void 0,
					n,
					size,
					...args
				}),
				failedResponseHandler: createJsonErrorResponseHandler((_d = this.config.errorStructure) != null ? _d : defaultOpenAICompatibleErrorStructure),
				successfulResponseHandler: createJsonResponseHandler(openaiCompatibleImageResponseSchema),
				abortSignal,
				fetch: this.config.fetch
			});
			return {
				images: response2.data.map((item) => item.b64_json),
				warnings,
				response: {
					timestamp: currentDate,
					modelId: this.modelId,
					headers: responseHeaders2
				}
			};
		}
		const { value: response, responseHeaders } = await postJsonToApi({
			url: this.config.url({
				path: "/images/generations",
				modelId: this.modelId
			}),
			headers: combineHeaders(this.config.headers(), headers),
			body: {
				model: this.modelId,
				prompt,
				n,
				size,
				...args,
				response_format: "b64_json"
			},
			failedResponseHandler: createJsonErrorResponseHandler((_e = this.config.errorStructure) != null ? _e : defaultOpenAICompatibleErrorStructure),
			successfulResponseHandler: createJsonResponseHandler(openaiCompatibleImageResponseSchema),
			abortSignal,
			fetch: this.config.fetch
		});
		return {
			images: response.data.map((item) => item.b64_json),
			warnings,
			response: {
				timestamp: currentDate,
				modelId: this.modelId,
				headers: responseHeaders
			}
		};
	}
};
var openaiCompatibleImageResponseSchema = object({ data: array(object({ b64_json: string() })) });
async function fileToBlob(file) {
	if (file.type === "url") return downloadBlob(file.url);
	const data = file.data instanceof Uint8Array ? file.data : convertBase64ToUint8Array(file.data);
	return new Blob([data], { type: file.mediaType });
}
function toCamelCase(str) {
	return str.replace(/[_-]([a-z])/g, (g) => g[1].toUpperCase());
}
var VERSION = "2.0.30";
function createOpenAICompatible(options) {
	const baseURL = withoutTrailingSlash(options.baseURL);
	const providerName = options.name;
	const headers = {
		...options.apiKey && { Authorization: `Bearer ${options.apiKey}` },
		...options.headers
	};
	const getHeaders = () => withUserAgentSuffix(headers, `ai-sdk/openai-compatible/${VERSION}`);
	const getCommonModelConfig = (modelType) => ({
		provider: `${providerName}.${modelType}`,
		url: ({ path }) => {
			const url = new URL(`${baseURL}${path}`);
			if (options.queryParams) url.search = new URLSearchParams(options.queryParams).toString();
			return url.toString();
		},
		headers: getHeaders,
		fetch: options.fetch
	});
	const createLanguageModel = (modelId) => createChatModel(modelId);
	const createChatModel = (modelId) => new OpenAICompatibleChatLanguageModel(modelId, {
		...getCommonModelConfig("chat"),
		includeUsage: options.includeUsage,
		supportsStructuredOutputs: options.supportsStructuredOutputs,
		transformRequestBody: options.transformRequestBody,
		metadataExtractor: options.metadataExtractor
	});
	const createCompletionModel = (modelId) => new OpenAICompatibleCompletionLanguageModel(modelId, {
		...getCommonModelConfig("completion"),
		includeUsage: options.includeUsage
	});
	const createEmbeddingModel = (modelId) => new OpenAICompatibleEmbeddingModel(modelId, { ...getCommonModelConfig("embedding") });
	const createImageModel = (modelId) => new OpenAICompatibleImageModel(modelId, getCommonModelConfig("image"));
	const provider = (modelId) => createLanguageModel(modelId);
	provider.specificationVersion = "v3";
	provider.languageModel = createLanguageModel;
	provider.chatModel = createChatModel;
	provider.completionModel = createCompletionModel;
	provider.embeddingModel = createEmbeddingModel;
	provider.textEmbeddingModel = createEmbeddingModel;
	provider.imageModel = createImageModel;
	return provider;
}
export { createOpenAICompatible as n, OpenAICompatibleChatLanguageModel as t };
