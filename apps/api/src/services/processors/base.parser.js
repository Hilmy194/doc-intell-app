class BaseParser {
  constructor(name) {
    this.name = name;
  }

  async parse(_filePath, _ctx = {}) {
    throw new Error(`parse() is not implemented for engine "${this.name}"`);
  }

  async extract(_filePath, _schema = {}, _ctx = {}) {
    throw new Error(`extract() is not implemented for engine "${this.name}"`);
  }

  async split(_filePath, _ctx = {}) {
    throw new Error(`split() is not implemented for engine "${this.name}"`);
  }
}

module.exports = BaseParser;
