import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Station } from "../models/Station";

// Interface for connection data
interface ConnectionData {
  from: string;
  to: string;
  line: string;
  time: number;
}

const Tubemap: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [stations, setStations] = useState<Map<string, Station>>(new Map());
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [fastestRoute, setFastestRoute] = useState<Station[]>([]);
  const [fromStation, setFromStation] = useState<string>("");
    const [toStation, setToStation] = useState<string>("");
    const [filteredFromStations, setFilteredFromStations] = useState<string[]>([]);
    const [filteredToStations, setFilteredToStations] = useState<string[]>([]);
    const [showFromDropdown, setShowFromDropdown] = useState<boolean>(false);
    const [showToDropdown, setShowToDropdown] = useState<boolean>(false);
  // Define file paths for stations and connections
  const stationFiles = [
    "/stations/bakerloo_stations.json",
    "/stations/central_stations.json",
    "/stations/circle_stations.json",
    "/stations/jubilee_stations.json",
    "/stations/piccadilly_stations.json",
    "/stations/victoria_stations.json",
  ];

  const connectionFiles = [
    "/connections/bakerloo_connections.json",
    "/connections/central_connections.json",
    "/connections/circle_connections.json",
    "/connections/jubilee_connections.json",
    "/connections/piccadilly_connections.json",
    "/connections/victoria_connections.json",
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all station files and wait for the results
        const stationDataArray = await Promise.all(
          stationFiles.map((file) => fetch(file).then((res) => res.json()))
        );
  
        const stationMap = new Map<string, Station>();
  
        // Populate stations from all files
        stationDataArray.forEach((stationData) => {
          stationData.stations.forEach((station: { name: string; x: number; y: number }) => {
            if (!stationMap.has(station.name)) {
              stationMap.set(
                station.name,
                new Station(station.name, station.x, station.y)
              );
            }
          });
        });
  
        setStations(stationMap); // Update state with loaded stations
  
        // Fetch all connection files after station data is loaded
        const connectionDataArray = await Promise.all(
          connectionFiles.map((file) => fetch(file).then((res) => res.json()))
        );
  
        const allConnections: ConnectionData[] = [];
  
        // Aggregate all connections from different lines
        connectionDataArray.forEach((connectionData) => {
          allConnections.push(...connectionData);
        });
  
        // Use addConnection method to establish connections between stations
        allConnections.forEach(({ from, to, line, time }) => {
          const fromStation = stationMap.get(from); // Use stationMap instead of stations state directly
          const toStation = stationMap.get(to);
          if (fromStation && toStation) {
            fromStation.addConnection(toStation, line, time);
          }
        });
  
        setConnections(allConnections); // Update state with loaded connections
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
  
    fetchData(); // Call the async function to execute the fetch logic
  }, []); // Empty dependency array ensures this effect runs only once
  
  useEffect(() => {
    if (!svgRef.current || stations.size === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const stationArray = Array.from(stations.values());

    const maxX = Math.max(...stationArray.map((s) => s.x));
    const maxY = Math.max(...stationArray.map((s) => s.y));

    const padding = 50;
    const width = maxX + padding;
    const height = maxY + padding;

    // Set SVG attributes
    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("preserveAspectRatio", "xMidYMid meet");

    // Tube line colors (consistent for northbound/southbound)
    const lineColors: { [key: string]: string } = {
      "Bakerloo": "brown",
      "Central": "red",
      "Circle": "yellow",
      "Jubilee": "grey",
      "Piccadilly": "darkblue",
      "Victoria": "lightblue",
    };

    // Normalize line names (e.g., remove directions)
    const getLineColor = (line: string) => {
      const baseLine = line.split(" ")[0]; // Extracts "Bakerloo" from "Bakerloo (Northbound)"
      return lineColors[baseLine] || "#999"; // Default color if not found
    };

    // Draw connections (lines)
    connections.forEach(({ from, to, line }) => {
      const fromStation = stations.get(from);
      const toStation = stations.get(to);
      if (fromStation && toStation) {
        // Check if both 'from' and 'to' stations are part of the fastest route
        const isFastestRoute = fastestRoute.includes(fromStation) && fastestRoute.includes(toStation);

        svg
          .append("line")
          .attr("x1", fromStation.x)
          .attr("y1", fromStation.y)
          .attr("x2", toStation.x)
          .attr("y2", toStation.y)
          .attr("stroke", isFastestRoute ? "green" : getLineColor(line)) // Set line color based on the tube line
          .attr("stroke-width", 3);
      }
    });

    // Draw stations (nodes)
    svg
      .selectAll("circle")
      .data(stationArray)
      .enter()
      .append("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 6) // Set radius of the circle (station)
      .attr("fill", (d) => (fastestRoute.includes(d) ? "green" : "blue"))
      .attr("stroke", "white")
      .attr("stroke-width", 1);

    // Add station labels
    svg
      .selectAll("text")
      .data(stationArray)
      .enter()
      .append("text")
      .attr("x", (d) => d.x + 8) // Position the label slightly offset from the station
      .attr("y", (d) => d.y - 8)
      .text((d) => d.name)
      .attr("font-size", "12px")
      .attr("fill", "black");
  }, [stations, connections, fastestRoute]); // Re-run this effect when stations or connections change
 // Find the fastest route (Dijkstra's algorithm)
 function findFastestRoute(startStation: Station, endStation: Station, stations: Station[]): Station[] {
    const shortestDistances = new Map<Station, number>();
    const previousStation = new Map<Station, Station | null>();
    const visited = new Set<Station>();
    // Initialize shortest distances for each station to infinity
    for (const station of stations) {
      shortestDistances.set(station, Infinity);
    }

    // The start station has a distance of 0
    shortestDistances.set(startStation, 0);

    while (visited.size !== stations.length) {
      let currentStation: Station | null = null;
      let shortestDistance = Infinity;

      // Find the station with the smallest distance that hasn't been visited
      for (const station of stations) {
        if (!visited.has(station) && shortestDistances.get(station)! < shortestDistance) {
          currentStation = station;
          shortestDistance = shortestDistances.get(station)!;
        }
      }

      if (!currentStation) {
        break; // No more stations to visit, break out of the loop
      }

      visited.add(currentStation);

      // Update the shortest distances for the neighbors of the current station
      for (const connection of currentStation.connections) {
        const distance = shortestDistances.get(currentStation)! + connection.travelTime;
        if (distance < shortestDistances.get(connection.connectedStation)!) {
          shortestDistances.set(connection.connectedStation, distance);
          previousStation.set(connection.connectedStation, currentStation);
        }
      }
    }

    // Reconstruct the path from endStation to startStation
    const path: Station[] = [];
    let tempStation: Station | null = endStation;

    while (tempStation !== null && previousStation.has(tempStation)) {
      path.push(tempStation);
      tempStation = previousStation.get(tempStation)!;
    }
    path.push(tempStation);
    path.reverse();
    return path;
  }

// Filter stations based on input search term
const filteredStations = (searchTerm: string) => {
    return Array.from(stations.values()).filter((station) =>
      station.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setFromStation(input);
  
    // Filter station names based on the 'name' property of each station instance
    setFilteredFromStations(
      input
        ? Array.from(stations.values())
            .filter((station) =>
              station.name.toLowerCase().startsWith(input.toLowerCase())
            )
            .map((station) => station.name) // Map to an array of station names
        : []
    );
  
    // Show dropdown only if there's input
    setShowFromDropdown(!!input);
  };
  
  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setToStation(input);
  
    // Filter station names based on the 'name' property of each station instance
    setFilteredToStations(
      input
        ? Array.from(stations.values())
            .filter((station) =>
              station.name.toLowerCase().startsWith(input.toLowerCase())
            )
            .map((station) => station.name) // Map to an array of station names
        : []
    );
  
    // Show dropdown only if there's input
    setShowToDropdown(!!input);
  };
  
  const handleFromSelect = (station: string) => {
    setFromStation(station);
    setFilteredFromStations([]);
    setShowFromDropdown(false);
  };

  const handleToSelect = (station: string) => {
    setToStation(station);
    setFilteredToStations([]);
    setShowToDropdown(false);
  };
  
  // Button click handler to calculate the fastest route
  const handleFindFastestRoute = () => {
    // Convert the Map of stations to an array
    const stationArray = Array.from(stations.values());

    // Find start and end stations based on user input
    const startStation = stationArray.find(station => station.name === fromStation);
    const endStation = stationArray.find(station => station.name === toStation);

    if (!startStation || !endStation) {
      alert("Invalid stations. Please make sure the stations are correct.");
      return;
    }

    // Find the fastest route (assuming findFastestRoute is a valid function)
    const route = findFastestRoute(startStation, endStation, stationArray);
    setFastestRoute(route);
  };
  
  
  
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px",
        backgroundColor: "#f4f7fc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "30px" }}>
        {/* From Station Input */}
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={fromStation}
            onChange={handleFromChange}
            placeholder="From"
            style={{
              padding: "10px",
              width: "200px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              outline: "none",
              fontSize: "14px",
              transition: "border-color 0.3s",
            }}
          />
          {showFromDropdown && (
            <ul
              style={{
                position: "absolute",
                background: "#fff",
                border: "1px solid #ccc",
                listStyle: "none",
                padding: "5px",
                margin: 0,
                width: "200px",
                borderRadius: "8px",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
                zIndex: 10,
              }}
            >
              {filteredFromStations.map((station) => (
                <li
                  key={station}
                  style={{
                    padding: "8px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                    transition: "background-color 0.3s",
                  }}
                  onClick={() => handleFromSelect(station)}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = "#f1f1f1"}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = "transparent"}
                >
                  {station}
                </li>
              ))}
            </ul>
          )}
        </div>
  
        {/* To Station Input */}
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={toStation}
            onChange={handleToChange}
            placeholder="To"
            style={{
              padding: "10px",
              width: "200px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              outline: "none",
              fontSize: "14px",
              transition: "border-color 0.3s",
            }}
          />
          {showToDropdown && (
            <ul
              style={{
                position: "absolute",
                background: "#fff",
                border: "1px solid #ccc",
                listStyle: "none",
                padding: "5px",
                margin: 0,
                width: "200px",
                borderRadius: "8px",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
                zIndex: 10,
              }}
            >
              {filteredToStations.map((station) => (
                <li
                  key={station}
                  style={{
                    padding: "8px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                    transition: "background-color 0.3s",
                  }}
                  onClick={() => handleToSelect(station)}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = "#f1f1f1"}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = "transparent"}
                >
                  {station}
                </li>
              ))}
            </ul>
          )}
        </div>
  
        {/* Find Route Button */}
        <button
          onClick={handleFindFastestRoute}
          style={{
            padding: "10px 20px",
            cursor: "pointer",
            backgroundColor: "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            transition: "background-color 0.3s, transform 0.3s",
          }}
          onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = "#0056b3"}
          onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = "#007BFF"}
          onMouseDown={(e) => (e.target as HTMLElement).style.transform = "scale(0.98)"}
          onMouseUp={(e) => (e.target as HTMLElement).style.transform = "scale(1)"}
        >
          Find Route
        </button>
      </div>
  
      {/* Route Visualization and Fastest Route Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          width: "100%",
          gap: "30px", // Adding gap between the map and the fastest route section
        }}
      >
        {/* Map (SVG) Section */}
        <div
          style={{
            width: "50%", // Make sure the map takes half the width of the container
            height: "500px", // Fixed height for map
            backgroundColor: "#e0e0e0", // Grey background to indicate map area
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
            
          }}
        >
          <svg ref={svgRef} style={{ width: "100%", height: "100%" }}></svg>
        </div>
  
        {/* Fastest Route Section */}
        <div
          style={{
            width: "300px", // Fixed width for the fastest route section
            backgroundColor: "#fff",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
            minHeight: "500px", // Ensure this section always takes up enough space
          }}
        >
          {fastestRoute.length > 0 && (
  <>
    <h3 style={{ fontSize: "18px", color: "#333", marginBottom: "10px" }}>
      Fastest Route (Highlighted in green on map):
    </h3>
    <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "5px" }}>
      {fastestRoute.map((station, index) => {
        const nextStation = fastestRoute[index + 1];
        const connection = nextStation ? station.getConnectionTo(nextStation) : null;
        
        return (
          <li key={index} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#555" }}>
            <span style={{ flex: 1 }}>{station.name}</span>
            {connection && nextStation && (
              <>
                <span style={{ flex: 1, textAlign: "right" }}>
                  {connection.line}
                </span>
                <span style={{ flex: 1, textAlign: "right" }}>
                  {connection.travelTime} min
                </span>
              </>
            )}
          </li>
        );
      })}
    </ul>
    
    {/* Calculate and display the total travel time */}
    <div style={{ fontSize: "16px", color: "#333", marginTop: "10px" }}>
      Travel time:{" "}
      {fastestRoute.reduce((totalTime, station, index) => {
        const nextStation = fastestRoute[index + 1];
        const connection = nextStation ? station.getConnectionTo(nextStation) : null;
        return connection ? totalTime + connection.travelTime : totalTime;
      }, 0).toFixed(2)} min
    </div>
  </>
)}


        </div>
      </div>
    </div>
  );
  
  
};

export default Tubemap;