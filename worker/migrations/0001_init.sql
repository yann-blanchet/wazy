CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  record_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  restaurant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  record_json TEXT NOT NULL,
  city TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  geo_cell TEXT,
  lat REAL,
  lng REAL,
  PRIMARY KEY (restaurant_id, type)
);

CREATE INDEX IF NOT EXISTS posts_city_expires ON posts (city, expires_at);
CREATE INDEX IF NOT EXISTS posts_expires ON posts (expires_at);

CREATE TABLE IF NOT EXISTS osm_map (
  osm_type TEXT NOT NULL,
  osm_id INTEGER NOT NULL,
  restaurant_id TEXT NOT NULL,
  PRIMARY KEY (osm_type, osm_id)
);

CREATE INDEX IF NOT EXISTS osm_map_restaurant_id ON osm_map (restaurant_id);
