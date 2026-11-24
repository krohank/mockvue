import { aiService } from '../src/services/ai/AIProviderFactory.js';
const status = await aiService.status();
console.log(JSON.stringify(status, null, 2));
