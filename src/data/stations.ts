import { Station } from "../models/Station";

// Updated coordinates with stations spaced out evenly while maintaining their directions and angles
export const stations: Station[] = [
  // Walthamstow (Top-right, starting point)
  new Station("Walthamstow", 1000, 100),
  
  // Blackhorse Road (moving west from Walthamstow)
  new Station("Blackhorse Road", 900, 100),
  
  // Tottenham Hale (moving west)
  new Station("Tottenham Hale", 800, 100),
  
  // Seven Sisters (west direction, still in the north region)
  new Station("Seven Sisters", 700, 100),
  
  // Finsbury Park (southwest direction from Seven Sisters)
  new Station("Finsbury Park", 650, 200),
  
  // Highbury (moving south from Finsbury Park)
  new Station("Highbury", 650, 250),
  
  // Kings Cross St Pancras (west direction from Highbury)
  new Station("Kings Cross St Pancras", 550, 300),
  
  // Euston (moving west)
  new Station("Euston", 450, 300),
  
  // Warren Street (moving southwest from Euston)
  new Station("Warren Street", 400, 400),
  
  // Oxford Circus (moving southwest)
  new Station("Oxford Circus", 350, 500),
  
  // Green Park (southwest direction from Oxford Circus)
  new Station("Green Park", 300, 600),
  
  // Victoria (moving south from Green Park)
  new Station("Victoria", 250, 700),
  
  // Pimlico (south direction from Victoria)
  new Station("Pimlico", 250, 800),
  
  // Vauxhall (moving south from Pimlico)
  new Station("Vauxhall", 250, 900),
  
  // Stockwell (moving southeast from Vauxhall)
  new Station("Stockwell", 300, 1000),
  
  // Brixton (southeast direction from Stockwell)
  new Station("Brixton", 350, 1100),




// Updated Station Coordinates based on instructions

// Updated Station Coordinates with even spacing from Edgware Road to South Kensington at (150, 700)

new Station("Edgware Road", 150, 350),  // Starting at (150, 350)

// Paddington Circle
new Station("Paddington Circle", 150, 400),  // 50 units down

// Bayswater
new Station("Bayswater", 150, 450),  // 100 units down

// Notting Hill Gate
new Station("Notting Hill Gate", 150, 500),  // 150 units down

// High Street Kensington
new Station("High Street Kensington", 150, 550),  // 200 units down

// Gloucester Road
new Station("Gloucester Road", 150, 600),  // 250 units down

// South Kensington (updated to y = 700)
new Station("South Kensington", 150, 700),  // 350 units down

// Turn right and move to Temple
new Station("Sloane Square", 200, 700),
new Station("St James Park", 350, 700),
new Station("Westminster", 500, 700),
new Station("Embankment", 650, 700),
new Station("Temple", 800, 700),


// Turn upwards from Temple towards Farringdon
new Station("Blackfriars", 850, 640),
new Station("Mansion House", 900, 580),
new Station("Cannon Street", 950, 520),
new Station("Monument", 1050, 520),
new Station("Tower Hill", 1150, 520),


// Move left towards Farringdon
new Station("Aldgate", 1150, 460),
new Station("Liverpool Street", 1050, 460),
new Station("Moorgate", 950, 460),
new Station("Barbican", 850, 400),
new Station("Farringdon", 750, 340),


// The rest stations can follow based on the needed structure.
new Station("Euston Square", 400, 340),
new Station("Great Portland Street", 250, 340),
new Station("Paddington H C", 100, 340),
new Station("Royal Oak", 60, 390),
new Station("Westbourne Park", 20, 440),
new Station("Ladbroke Grove", -20, 490),
new Station("Latimer Road", -60, 540),
new Station("Wood Lane", -60, 590),
new Station("Shepherds Bush Market", -60, 640),
new Station("Goldhawk Road", -60, 690),
new Station("Hammersmith H C", -60, 740),

/////////////////////////////////////////////////////////////////////////////////

new Station("Stanmore", 0, 15), 
new Station("Canons Park", 0, 60), 
new Station("Queensbury", 0, 110), 
new Station("Kingsbury", 0, 160), 
new Station("Wembley Park", 25, 177.5),
new Station("Neasden", 50, 195),
new Station("Dollis Hill", 75, 212.5),
new Station("Willesden Green", 100, 230),
new Station("Kilburn", 125, 247.5),
new Station("West Hampstead", 150, 265),
new Station("Finchley Road", 175, 282.5),
new Station("Swiss Cottage", 200, 300), 
new Station("St John's Wood", 225, 320), 
new Station("Baker Street", 275, 360), 
new Station("Bond Street", 275, 450),  
new Station("Waterloo", 500, 900), 
new Station("Southwark", 600, 900), 
new Station("London Bridge", 700, 800), 
new Station("Bermondsey", 800, 800), 
new Station("Canada Water", 900, 800), 
new Station("Canary Wharf", 1000, 800), 
new Station("North Greenwich", 1200, 800), 
new Station("Canning Town", 1200, 700), 
new Station("West Ham", 1200, 600), 
new Station("Stratford", 1200, 500),
////////////////////////////////////////

new Station("Queensway", 200, 525),
new Station("Lancaster Gate", 225, 500),
new Station("Marble Arch", 250, 475),
new Station("Tottenham Court Road", 430, 500),
new Station("Holborn", 550, 500),
new Station("Chancery Lane", 640, 500),
new Station("St Paul's", 760, 500),
new Station("Bank", 880, 500),

//////
new Station("Regents Park", 320, 400),
new Station("Piccadilly Circus", 400, 600),
new Station("Charing Cross", 520, 630),
////////////

new Station("Knightsbridge", 200, 650),
new Station("Hyde Park Corner", 225, 625),
new Station("Leicester Square", 450, 562),
new Station("Covent Garden", 490, 540),
new Station("Russell Square", 550, 400)

  
];

// Add connections based on journey times
stations[0].addConnection(stations[1], "Victoria", 2.12);
stations[1].addConnection(stations[2], "Victoria", 1.90);
stations[2].addConnection(stations[3], "Victoria", 2.00);
stations[3].addConnection(stations[4], "Victoria", 3.77);
stations[4].addConnection(stations[5], "Victoria", 2.90);
stations[5].addConnection(stations[6], "Victoria", 2.77);
stations[6].addConnection(stations[7], "Victoria", 1.32);
stations[7].addConnection(stations[8], "Victoria", 1.30);
stations[8].addConnection(stations[9], "Victoria", 1.72);
stations[9].addConnection(stations[10], "Victoria", 1.78);
stations[10].addConnection(stations[11], "Victoria", 1.88);
stations[11].addConnection(stations[12], "Victoria", 1.83);
stations[12].addConnection(stations[13], "Victoria", 1.40);
stations[13].addConnection(stations[14], "Victoria", 2.30);
stations[14].addConnection(stations[15], "Victoria", 2.03);

// Add return connections (Northbound)
stations[15].addConnection(stations[14], "Victoria", 2.18);
stations[14].addConnection(stations[13], "Victoria", 2.23);
stations[13].addConnection(stations[12], "Victoria", 1.37);
stations[12].addConnection(stations[11], "Victoria", 2.18);
stations[11].addConnection(stations[10], "Victoria", 1.95);
stations[10].addConnection(stations[9], "Victoria", 1.97);
stations[9].addConnection(stations[8], "Victoria", 1.53);
stations[8].addConnection(stations[7], "Victoria", 1.32);
stations[7].addConnection(stations[6], "Victoria", 1.35);
stations[6].addConnection(stations[5], "Victoria", 2.87);
stations[5].addConnection(stations[4], "Victoria", 2.40);
stations[4].addConnection(stations[3], "Victoria", 4.25);
stations[3].addConnection(stations[2], "Victoria", 1.60);
stations[2].addConnection(stations[1], "Victoria", 1.97);
stations[1].addConnection(stations[0], "Victoria", 2.12);

// Add connections (starting from stations[16] onward)
stations[16].addConnection(stations[17], "Circle (Inner)", 1.85);
stations[17].addConnection(stations[18], "Circle (Inner)", 1.65);
stations[18].addConnection(stations[19], "Circle (Inner)", 1.47);
stations[19].addConnection(stations[20], "Circle (Inner)", 1.58);
stations[20].addConnection(stations[21], "Circle (Inner)", 1.80);
stations[21].addConnection(stations[22], "Circle (Inner)", 1.43);
stations[22].addConnection(stations[23], "Circle (Inner)", 1.98);
stations[23].addConnection(stations[11], "Circle (Inner)", 1.80);  // Index 11 for Victoria
stations[11].addConnection(stations[24], "Circle (Inner)", 1.42);
stations[24].addConnection(stations[25], "Circle (Inner)", 1.50);
stations[25].addConnection(stations[26], "Circle (Inner)", 1.37);
stations[26].addConnection(stations[27], "Circle (Inner)", 1.37);
stations[27].addConnection(stations[28], "Circle (Inner)", 1.40);
stations[28].addConnection(stations[29], "Circle (Inner)", 1.52);
stations[29].addConnection(stations[30], "Circle (Inner)", 0.98);
stations[30].addConnection(stations[31], "Circle (Inner)", 0.97);
stations[31].addConnection(stations[32], "Circle (Inner)", 1.80);
stations[32].addConnection(stations[33], "Circle (Inner)", 1.30);
stations[33].addConnection(stations[34], "Circle (Inner)", 1.75);
stations[34].addConnection(stations[35], "Circle (Inner)", 1.32);
stations[35].addConnection(stations[36], "Circle (Inner)", 1.38);
stations[36].addConnection(stations[37], "Circle (Inner)", 1.20);
stations[37].addConnection(stations[6], "Circle (Inner)", 3.12);  // Index 6 for Kings Cross
stations[6].addConnection(stations[38], "Circle (Inner)", 1.65);
stations[38].addConnection(stations[39], "Circle (Inner)", 1.30);
stations[39].addConnection(stations[40], "Circle (Inner)", 1.57);
stations[40].addConnection(stations[41], "Circle (Inner)", 1.33);
stations[41].addConnection(stations[42], "Circle (Inner)", 1.72);
stations[42].addConnection(stations[43], "Circle (Inner)", 1.48);
stations[43].addConnection(stations[44], "Circle (Inner)", 1.28);
stations[44].addConnection(stations[45], "Circle (Inner)", 0);
stations[45].addConnection(stations[46], "Circle (Inner)", 0);
stations[46].addConnection(stations[47], "Circle (Inner)", 1.15);
stations[47].addConnection(stations[48], "Circle (Inner)", 2.43);
//Reverse above from 48 to 47 to 17 to 16
//



stations[49].addConnection(stations[50], "Jubilee (Eastbound)", 1.95); // Stanmore -> Canons Park
stations[50].addConnection(stations[51], "Jubilee (Eastbound)", 1.93); // Canons Park -> Queensbury
stations[51].addConnection(stations[52], "Jubilee (Eastbound)", 1.72); // Queensbury -> Kingsbury
stations[52].addConnection(stations[53], "Jubilee (Eastbound)", 3.47); // Kingsbury -> Wembley Park
stations[53].addConnection(stations[54], "Jubilee (Eastbound)", 2.60); // Wembley Park -> Neasden
stations[54].addConnection(stations[55], "Jubilee (Eastbound)", 1.43); // Neasden -> Dollis Hill
stations[55].addConnection(stations[56], "Jubilee (Eastbound)", 1.80); // Dollis Hill -> Willesden Green
stations[56].addConnection(stations[57], "Jubilee (Eastbound)", 1.68); // Willesden Green -> Kilburn
stations[57].addConnection(stations[58], "Jubilee (Eastbound)", 1.63); // Kilburn -> West Hampstead
stations[58].addConnection(stations[59], "Jubilee (Eastbound)", 1.25); // West Hampstead -> Finchley Road
stations[59].addConnection(stations[60], "Jubilee (Eastbound)", 1.18); // Finchley Road -> Swiss Cottage
stations[60].addConnection(stations[61], "Jubilee (Eastbound)", 1.52); // Swiss Cottage -> St John's Wood
stations[61].addConnection(stations[62], "Jubilee (Eastbound)", 2.77); // St John's Wood -> Baker Street
stations[62].addConnection(stations[63], "Jubilee (Eastbound)", 2.10); // Baker Street -> Bond Street
stations[63].addConnection(stations[10], "Jubilee (Eastbound)", 1.78); // Bond Street -> Green Park
stations[10].addConnection(stations[25], "Jubilee (Eastbound)", 1.87); // Green Park -> Westminster (stations[25])
stations[25].addConnection(stations[64], "Jubilee (Eastbound)", 1.38); 
stations[64].addConnection(stations[65], "Jubilee (Eastbound)", 1.02); // Waterloo -> Southwark
stations[65].addConnection(stations[66], "Jubilee (Eastbound)", 1.65); // Southwark -> London Bridge
stations[66].addConnection(stations[67], "Jubilee (Eastbound)", 2.25); // London Bridge -> Bermondsey
stations[67].addConnection(stations[68], "Jubilee (Eastbound)", 1.48); // Bermondsey -> Canada Water
stations[68].addConnection(stations[69], "Jubilee (Eastbound)", 2.50); // Canada Water -> Canary Wharf
stations[69].addConnection(stations[70], "Jubilee (Eastbound)", 2.23); // Canary Wharf -> North Greenwich
stations[70].addConnection(stations[71], "Jubilee (Eastbound)", 2.15); // North Greenwich -> Canning Town
stations[71].addConnection(stations[72], "Jubilee (Eastbound)", 2.15); // Canning Town -> West Ham
stations[72].addConnection(stations[73], "Jubilee (Eastbound)", 3.15); // West Ham -> Stratford


/////
stations[19].addConnection(stations[74], "centra;", 2.12);
stations[74].addConnection(stations[75], "central;", 2.12);
stations[75].addConnection(stations[76], "centra;", 2.12);
stations[76].addConnection(stations[63], "centra;", 2.12);
stations[63].addConnection(stations[9], "central;", 2.12);
stations[9].addConnection(stations[77], "centra;", 2.12);
stations[77].addConnection(stations[78], "centra;", 2.12);
stations[78].addConnection(stations[79], "centra;", 2.12);
stations[79].addConnection(stations[80], "centra;", 2.12);
stations[80].addConnection(stations[81], "centra;", 2.12);
stations[81].addConnection(stations[34], "centra;", 2.12);

////
stations[62].addConnection(stations[82], "bak;", 2.12);
stations[82].addConnection(stations[9], "bak;", 2.12);
stations[9].addConnection(stations[83], "bak;", 2.12);
stations[83].addConnection(stations[84], "bak;", 2.12);
stations[84].addConnection(stations[26], "bak;", 2.12);

/////

stations[22].addConnection(stations[85], "pica;", 2.12);
stations[85].addConnection(stations[86], "pica;", 2.12);
stations[86].addConnection(stations[10], "pica;", 2.12);
stations[10].addConnection(stations[83], "pica;", 2.12);
stations[83].addConnection(stations[87], "pica;", 2.12);
stations[87].addConnection(stations[88], "pica;", 2.12);
stations[88].addConnection(stations[78], "pica;", 2.12);
stations[78].addConnection(stations[89], "pica;", 2.12);
stations[89].addConnection(stations[6], "pica;", 2.12);
