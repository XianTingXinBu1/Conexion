/**
 * API 服务模块
 *
 * 提供统一的 API 服务层
 */

// 错误类型与错误体解析
export { ApiRequestError, ApiTimeoutError, extractApiErrorMessage, parseApiErrorMessage } from './errors';
export type { ApiErrorResponseBody } from './errors';

// 传输原语（超时 / 取消）
export { LOCAL_REQUEST_TIMEOUT_MS, createTimeoutController } from './transport';
export type { AbortControllerHandle } from './transport';

// 基类
export { ApiClient } from './base';
export type { ApiClientConfig, RequestOptions } from './base';

// 聊天 API
export { ChatApi } from './chat';

// 模型 API
export { ModelsApi } from './models';