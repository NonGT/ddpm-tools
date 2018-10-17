const argv = require('minimist')(process.argv.slice(2));
const moment = require('moment');
const fs = require('fs');

if (!argv.in || !argv.out) {
	console.info(
    'Usage: node landslide-risk-table-gen',
    '--in=path/to/riskmap.json',
    '--out=path/to/output/folder',
  );
	return;
}

const inputData = require(argv.in);

function getRiskMapData(row, col) {
  const initialLat = 21.14179252214518;
  const maxLat = 4.99131981531108;
  const initialLng = 96.19873159784592;
  const maxLng = 107.36690970775354;
  const xCells = 288;
  const yCells = 419;
  const latIncrement = (maxLat - initialLat) / yCells;
  const lngIncrement = (maxLng - initialLng) / xCells;
  const riskValue = inputData[row][col];

  const lat1 = initialLat + (row * latIncrement);
  const lng1 = initialLng + (col * lngIncrement);

  // const latLng1 = L.latLng(lat1, lng1);

  const lat2 = lat1 + latIncrement;
  const lng2 = lng1 + lngIncrement;
  // const latLng2 = L.latLng(lat2, lng2);

  // console.log(latLng1, latLng2);
  return {
    tl: { lat: lat1, lng: lng1 },
    br: { lat: lat2, lng: lng2 },
    c: { lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2 },
    value: riskValue,
  };
}

const csv = [['tl-lat', 'tl-lng', 'br-lat', 'br-lng', 'c-lat', 'c-lng', 'value']];

inputData.forEach((row, i) => {
  row.forEach((col, j) => {
    if (col <= 0) {
      return;
    }

    const { tl, br, c, value } = getRiskMapData(i, j);
    csv.push([
      tl.lat, tl.lng,
      br.lat, br.lng,
      c.lat, c.lng,
      value,
    ].join(','));
  });
});

const final = csv.join('\n');

fs.writeFileSync(
  `${argv.out}/riskmap-table.csv`,
  final
)