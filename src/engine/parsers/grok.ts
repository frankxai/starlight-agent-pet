import { AgentSession } from '../types';

export class GrokKiloParser {
  public async parseAllSessions(_limit = 10): Promise<AgentSession[]> {
    // A Kilo config file proves installation, not execution or usage. Return no
    // session until a measured Kilo/Grok event source is available.
    return [];
  }
}
