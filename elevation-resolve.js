const argv = require('minimist')(process.argv.slice(2));
const fetch = require('node-fetch');
const fs = require('fs');

if (!argv.station || !argv.out || !argv.existing || !argv.googleApiKey) {
	console.info(
    'Usage: node elevation-resolve',
    '--station=path/to/stations.json',
    '--existing=path/to/resolved.json',
    '--out=path/to/output',
    '--googleApiKey=api-key'
  );
	return;
}

const stations = require(argv.station);
const stationElevations = [];

const existing = require(argv.existing);
const existingLookup = existing && existing.reduce((lookup, station) => ({
  ...lookup,
  ...{
    [station.id]: station,
  }
}));

function sleep(ms){
  return new Promise(resolve=>{
      setTimeout(resolve,ms)
  })
}

async function getElevation(lat, lng) {
  const apiKey =  argv.googleApiKey;
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (response.status === 200) {
      const resp = await response.json();
      if (resp.status === 'OK') {
        return resp.results[0].elevation;
      }

      return null;
    }
    await sleep(200);
  } catch(e) {
    throw e;
  }
}

async function doJob() {
  for (const station of stations) {
    if (existingLookup && (station.station_id in existingLookup)) {
      const existing = existingLookup[station.station_id];
      if (existing.elevation) {
        stationElevations.push(existing);
        continue;
      }
    }

    const elevation = await getElevation(station.latitude, station.longitude);
    stationElevations.push({
      id: station.station_id,
      name: station.name_th,
      elevation: elevation
    });
  };

  fs.writeFileSync(argv.out, JSON.stringify(stationElevations, null, 2));
}

doJob();