import * as fs from 'fs-extra';
import { ContractAST, StateVariable } from './types';

export class SolidityParser {
  protected filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async parse(): Promise<ContractAST[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      return this.parseContent(content);
    } catch (error) {
      throw new Error(`Failed to parse Solidity file: ${error}`);
    }
  }

  private parseContent(content: string): ContractAST[] {

    const contracts: ContractAST[] = [];


    const contractMatches = content.match(/contract\s+(\w+)(?:\s+is\s+([^{]+))?\s*{([^}]*)}/g);

    if (contractMatches) {
      contractMatches.forEach(match => {
        const nameMatch = match.match(/contract\s+(\w+)/);
        if (nameMatch) {
          const contractName = nameMatch[1];

          const contractAST: ContractAST = {
            name: contractName,
            baseContracts: this.extractBaseContracts(match),
            stateVariables: this.extractStateVariables(match),
            functions: this.extractFunctions(match),
            events: this.extractEvents(match),
            modifiers: this.extractModifiers(match),
            isAbstract: false,
            isInterface: false,
            isLibrary: false
          };

          contracts.push(contractAST);
        }
      });
    }

    return contracts;
  }

  private extractBaseContracts(contractSource: string): string[] {
    const match = contractSource.match(/contract\s+\w+\s+is\s+([^{]+)/);
    if (match) {
      return match[1].split(',').map(base => base.trim());
    }
    return [];
  }

  private extractStateVariables(contractSource: string): StateVariable[] {
    const variables: StateVariable[] = [];


    const variableMatches = contractSource.match(/\s+(uint256|uint|int|address|bool|string|bytes32)\s+(public|private|internal)?\s+(\w+);/g);

    if (variableMatches) {
      variableMatches.forEach(match => {
        const parts = match.trim().split(/\s+/);
        if (parts.length >= 2) {
          const typeName = parts[0];
          const name = parts[parts.length - 1].replace(';', '');
          const visibility = parts.includes('public') ? 'public' :
                           parts.includes('private') ? 'private' :
                           parts.includes('internal') ? 'internal' : 'internal';

          variables.push( {
            name,
            typeName,
            visibility: visibility as 'public' | 'private' | 'internal' | 'external',
            isConstant: match.includes('constant'),
            isImmutable: match.includes('immutable')
          });
        }
      });
    }

    return variables;
  }

  private extractFunctions(contractSource: string): import('./types').Function[] {

    return [];
  }

  private extractEvents(contractSource: string): import('./types').Event[] {

    return [];
  }

  private extractModifiers(contractSource: string): import('./types').Modifier[] {

    return [];
  }
}
