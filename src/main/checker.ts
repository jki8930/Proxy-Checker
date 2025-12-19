import { EventEmitter } from 'events';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { updateProxy, deleteProxies } from './database';

export interface ProxyToCheck {
  id: number;
  ip: string;
  port: number;
  type: string;
  username?: string;
  password?: string;
}

export interface CheckResult {
  id: number;
  ip: string;
  port: number;
  type: string;
  status: 'working' | 'dead';
  latency?: number;
  country?: string;
  country_code?: string;
  anonymity?: string;
}

export interface CheckerOptions {
  threads: number;
  timeout: number;
  testUrl: string;
  deleteDead: boolean;
  checkAnonymity: boolean;
}

export class ProxyChecker extends EventEmitter {
  private options: CheckerOptions;
  private stopped = false;
  private checked = 0;
  private working = 0;
  private dead = 0;
  private total = 0;
  private logs: string[] = [];
  private deadIds: number[] = [];
  private myIp: string = '';

  constructor(options: CheckerOptions) {
    super();
    this.options = options;
  }

  stop() {
    this.stopped = true;
    this.addLog('⏹ Проверка остановлена пользователем');
  }

  private addLog(message: string) {
    const time = new Date().toLocaleTimeString();
    this.logs.push(`[${time}] ${message}`);
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }
  }

  async checkAll(proxies: ProxyToCheck[]): Promise<CheckResult[]> {
    this.stopped = false;
    this.checked = 0;
    this.working = 0;
    this.dead = 0;
    this.total = proxies.length;
    this.logs = [];
    this.deadIds = [];
    
    this.addLog(`🚀 Начало проверки ${this.total} прокси`);
    this.addLog(`⚙️ Потоков: ${this.options.threads}, Таймаут: ${this.options.timeout}ms`);
    this.addLog(`🔗 URL: ${this.options.testUrl}`);
    this.addLog(`🗑️ Удалять мёртвые: ${this.options.deleteDead ? 'Да' : 'Нет'}`);
    this.addLog(`🔒 Проверка анонимности: ${this.options.checkAnonymity ? 'Да' : 'Нет'}`);
    
    // Get our real IP for anonymity check
    if (this.options.checkAnonymity) {
      await this.detectMyIp();
    }
    
    this.emitProgress();
    
    const results: CheckResult[] = [];
    const queue = [...proxies];
    const activePromises: Promise<void>[] = [];
    
    const processNext = async (): Promise<void> => {
      while (queue.length > 0 && !this.stopped) {
        const proxy = queue.shift();
        if (!proxy) break;
        
        const result = await this.checkProxy(proxy);
        results.push(result);
        
        // Update or delete from database
        if (result.status === 'dead' && this.options.deleteDead) {
          this.deadIds.push(result.id);
        } else {
          updateProxy(result.id, {
            status: result.status,
            latency: result.latency,
            country: result.country,
            country_code: result.country_code,
            anonymity: result.anonymity,
            last_checked: Math.floor(Date.now() / 1000),
          });
        }
        
        this.checked++;
        if (result.status === 'working') {
          this.working++;
        } else {
          this.dead++;
        }
        
        this.emitProgress(result);
      }
    };
    
    const workerCount = Math.min(this.options.threads, proxies.length);
    for (let i = 0; i < workerCount; i++) {
      activePromises.push(processNext());
    }
    
    await Promise.all(activePromises);
    
    // Delete dead proxies if option enabled
    if (this.options.deleteDead && this.deadIds.length > 0) {
      this.addLog(`🗑️ Удаление ${this.deadIds.length} мёртвых прокси...`);
      deleteProxies(this.deadIds);
      this.addLog(`✅ Удалено ${this.deadIds.length} мёртвых прокси`);
    }
    
    this.addLog(`✅ Проверка завершена: ${this.working} рабочих, ${this.dead} мёртвых`);
    this.emitProgress();
    
    return results;
  }

  private async detectMyIp() {
    try {
      this.addLog('🔍 Определение вашего IP для проверки анонимности...');
      const response = await axios.get('http://httpbin.org/ip', { timeout: 10000 });
      this.myIp = response.data?.origin || '';
      if (this.myIp) {
        this.addLog(`📍 Ваш IP: ${this.myIp}`);
      }
    } catch {
      this.addLog('⚠️ Не удалось определить ваш IP');
    }
  }

  private emitProgress(lastResult?: CheckResult) {
    this.emit('progress', {
      checked: this.checked,
      total: this.total,
      working: this.working,
      dead: this.dead,
      deleted: this.deadIds.length,
      percent: this.total > 0 ? Math.round((this.checked / this.total) * 100) : 0,
      logs: this.logs.slice(-100),
      lastResult: lastResult ? {
        proxy: `${lastResult.ip}:${lastResult.port}`,
        status: lastResult.status,
        latency: lastResult.latency,
        anonymity: lastResult.anonymity,
      } : undefined,
    });
  }

  private async checkProxy(proxy: ProxyToCheck): Promise<CheckResult> {
    const proxyStr = `${proxy.ip}:${proxy.port}`;
    this.addLog(`🔍 ${proxyStr} (${proxy.type})`);
    
    const result: CheckResult = {
      id: proxy.id,
      ip: proxy.ip,
      port: proxy.port,
      type: proxy.type,
      status: 'dead',
    };

    try {
      const proxyUrl = this.buildProxyUrl(proxy);
      const agent = this.createAgent(proxyUrl, proxy.type);
      
      const startTime = Date.now();
      
      const response = await axios.get(this.options.testUrl, {
        httpAgent: agent,
        httpsAgent: agent,
        timeout: this.options.timeout,
        validateStatus: () => true,
      });
      
      const latency = Date.now() - startTime;
      
      if (response.status >= 200 && response.status < 400) {
        result.status = 'working';
        result.latency = latency;
        
        // Check anonymity if enabled
        if (this.options.checkAnonymity && this.myIp) {
          result.anonymity = await this.checkAnonymity(proxy, agent);
          this.addLog(`✅ ${proxyStr} — ${latency}ms, ${this.getAnonymityLabel(result.anonymity)}`);
        } else {
          result.anonymity = 'unknown';
          this.addLog(`✅ ${proxyStr} — ${latency}ms`);
        }
      } else {
        this.addLog(`❌ ${proxyStr} — HTTP ${response.status}`);
      }
    } catch (error: any) {
      const errMsg = error.code || error.message?.substring(0, 50) || 'Error';
      this.addLog(`❌ ${proxyStr} — ${errMsg}`);
      result.status = 'dead';
    }

    return result;
  }

  private getAnonymityLabel(level?: string): string {
    switch (level) {
      case 'elite': return '🛡️ Elite (высокая)';
      case 'anonymous': return '🔒 Anonymous (средняя)';
      case 'transparent': return '⚠️ Transparent (низкая)';
      default: return '❓ Неизвестно';
    }
  }

  private async checkAnonymity(proxy: ProxyToCheck, agent: any): Promise<string> {
    try {
      const response = await axios.get('http://httpbin.org/headers', {
        httpAgent: agent,
        httpsAgent: agent,
        timeout: this.options.timeout,
      });
      
      const headers = response.data?.headers || {};
      const headerStr = JSON.stringify(headers).toLowerCase();
      
      // Check if our real IP is visible
      if (this.myIp && headerStr.includes(this.myIp.toLowerCase())) {
        return 'transparent'; // Our IP is visible - bad!
      }
      
      // Check for proxy-revealing headers
      const proxyHeaders = [
        'x-forwarded-for',
        'x-real-ip', 
        'via',
        'x-proxy',
        'forwarded',
        'proxy-connection',
      ];
      
      const hasProxyHeaders = proxyHeaders.some(h => 
        headers[h] || headers[h.toLowerCase()] || headerStr.includes(h)
      );
      
      if (hasProxyHeaders) {
        return 'anonymous'; // Proxy detected but IP hidden
      }
      
      return 'elite'; // No traces of proxy - best!
    } catch {
      return 'unknown';
    }
  }

  private buildProxyUrl(proxy: ProxyToCheck): string {
    const auth = proxy.username && proxy.password 
      ? `${proxy.username}:${proxy.password}@` 
      : '';
    
    const protocol = proxy.type.toLowerCase().includes('socks') 
      ? proxy.type.toLowerCase() 
      : 'http';
    
    return `${protocol}://${auth}${proxy.ip}:${proxy.port}`;
  }

  private createAgent(proxyUrl: string, type: string) {
    if (type.toUpperCase().includes('SOCKS')) {
      return new SocksProxyAgent(proxyUrl);
    }
    return new HttpsProxyAgent(proxyUrl);
  }
}
