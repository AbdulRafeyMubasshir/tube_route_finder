import React, { useState } from "react";
import Tubemap from "./components/Tubemap";

const App: React.FC = () => {
  const [fromStation, setFromStation] = useState<string>("");
  const [toStation, setToStation] = useState<string>("");
  const [filteredFromStations, setFilteredFromStations] = useState<string[]>([]);
  const [filteredToStations, setFilteredToStations] = useState<string[]>([]);
  const [showFromDropdown, setShowFromDropdown] = useState<boolean>(false);
  const [showToDropdown, setShowToDropdown] = useState<boolean>(false);

  const stations = ["Walthamstow", "Oxford Circus", "Waterloo", "Baker Street"]; // Replace with actual station list

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setFromStation(input);
    setFilteredFromStations(
      input ? stations.filter((station) => station.toLowerCase().startsWith(input.toLowerCase())) : []
    );
    setShowFromDropdown(!!input); // Show dropdown only when input is not empty
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setToStation(input);
    setFilteredToStations(
      input ? stations.filter((station) => station.toLowerCase().startsWith(input.toLowerCase())) : []
    );
    setShowToDropdown(!!input); // Show dropdown only when input is not empty
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

  const findRoute = () => {
    if (fromStation && toStation) {
      console.log(`Finding route from ${fromStation} to ${toStation}`);
      // Call route-finding function here
      
    }
  };

  return (
    <div>
      <h1>London Underground Route Finder</h1>
      

      <Tubemap />
    </div>
  );
};

export default App;
