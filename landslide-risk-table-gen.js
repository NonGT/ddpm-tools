const argv = require('minimist')(process.argv.slice(2));
const moment = require('moment');
const fs = require('fs');

if (!argv.in || !argv.lin || !argv.out) {
	console.info(
    'Usage: node landslide-risk-table-gen',
    '--in=path/to/riskmap.json',
    '--lin=path/to/lossmap.json',
    '--out=path/to/output/folder',
  );
	return;
}

const inputData = require(argv.in);
const lossInputData = require(argv.lin);

function getRiskMapData(row, col) {
  const diffLat = 20.78740300044397 - 21.14179252214518;
  const diffLng = 97.25996186601748 - 96.19873159784592;

  const initialLat = 20.78740300044397;
  const maxLat = 4.99131981531108 + diffLat;
  const initialLng = 97.25996186601748;
  const maxLng = 107.36690970775354 + diffLng;
  const xCells = 285;
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

const csv = [['row', 'col', 'tl-lat', 'tl-lng', 'br-lat', 'br-lng', 'c-lat', 'c-lng', 'value', 'loss']];

inputData.forEach((row, i) => {
  row.forEach((col, j) => {
    if (col <= 0) {
      return;
    }

    const loss = lossInputData[i][j];
    const { tl, br, c, value } = getRiskMapData(i, j);
    csv.push([
      i, j,
      tl.lat, tl.lng,
      br.lat, br.lng,
      c.lat, c.lng,
      value,
      loss,
    ].join(','));
  });
});

const final = csv.join('\n');

fs.writeFileSync(
  `${argv.out}/riskmap-table.csv`,
  final
)