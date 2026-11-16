// ===== Edit this file to add your cars and tracks =====
// Car files go in assets/cars/, track files in assets/roads/
export const CAR_LENGTH = 3.2;           // every car is auto-scaled to this length
export const SLOT_X = [-4.2, -1.4, 1.4, 4.2];

export const CARS = [
  { id:'car1', name:'Apex GT',   file:'assets/cars/car1.glb', color:0xd7263d, stats:{speed:82, accel:70, handling:76, nitro:60} },
  { id:'car2', name:'Volt R',    file:'assets/cars/car2.glb', color:0x2f7de1, stats:{speed:74, accel:88, handling:70, nitro:72} },
  { id:'car3', name:'Solar S',   file:'assets/cars/car3.glb', color:0xf2b705, stats:{speed:90, accel:64, handling:62, nitro:80} },
  { id:'car4', name:'Mamba X',   file:'assets/cars/car4.glb', color:0x2fbf71, stats:{speed:70, accel:76, handling:92, nitro:58} },
];

export const TRACKS = [
  { id:'track1', name:'Harbor Run', file:'assets/roads/track1.glb' },
];
