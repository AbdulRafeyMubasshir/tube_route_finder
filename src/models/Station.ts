export class Station {
    name: string;
    x: number;
    y: number;
    connections: Connection[];
  
    constructor(name: string, x: number, y: number) {
      this.name = name;
      this.x = x; // X-coordinate for visualization
      this.y = y; // Y-coordinate for visualization
      this.connections = [];
    }
  
    addConnection(station: Station, line: string, travelTime: number = 1) {
      this.connections.push(new Connection(station, line, travelTime));
    }
  
    getConnectionTo(station: Station): Connection | undefined {
      return this.connections.find((c) => c.connectedStation === station);
    }
  
    getConnectionToDifferentLine(station: Station): Connection | undefined {
      return this.connections.find(
        (c) => c.connectedStation === station && c.line !== this.connections[0]?.line
      );
    }
  }
  
  export class Connection {
    connectedStation: Station;
    line: string;
    travelTime: number;
    delayTime: number;
  
    constructor(connectedStation: Station, line: string, travelTime: number = 1, delayTime: number = 0) {
      this.connectedStation = connectedStation;
      this.line = line;
      this.travelTime = travelTime;
      this.delayTime = delayTime;
    }
  }
  