import {
  BaseImageGenerator,
  BaseVideoGenerator,
  type GenerateResult,
  type ImageGenerateParams,
  type VideoGenerateParams,
} from './base'
import { generateGrokImage, generateGrokVideo } from '@/lib/providers/grok'

export class GrokImageGenerator extends BaseImageGenerator {
  protected async doGenerate(params: ImageGenerateParams): Promise<GenerateResult> {
    const modelId = typeof params.options?.modelId === 'string' ? params.options.modelId : ''
    const modelKey = typeof params.options?.modelKey === 'string' ? params.options.modelKey : ''
    const provider = typeof params.options?.provider === 'string' ? params.options.provider : 'grok'
    return await generateGrokImage({
      userId: params.userId,
      prompt: params.prompt,
      referenceImages: params.referenceImages,
      options: {
        ...params.options,
        provider,
        modelId,
        modelKey,
      },
    })
  }
}

export class GrokVideoGenerator extends BaseVideoGenerator {
  protected async doGenerate(params: VideoGenerateParams): Promise<GenerateResult> {
    const modelId = typeof params.options?.modelId === 'string' ? params.options.modelId : ''
    const modelKey = typeof params.options?.modelKey === 'string' ? params.options.modelKey : ''
    const provider = typeof params.options?.provider === 'string' ? params.options.provider : 'grok'
    return await generateGrokVideo({
      userId: params.userId,
      imageUrl: params.imageUrl,
      prompt: params.prompt,
      options: {
        ...params.options,
        provider,
        modelId,
        modelKey,
      },
    })
  }
}

