const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const shared = require('./shared');

const {
  getRndInteger,
  generateMeteorologyScoring,
  generateHydrologyScoring,
} = shared;

if (!argv.province || !argv.out) {
	console.info(
    'Usage: node drought-summary-gen',
    '--province=path/to/provinces.json',
    '--haii=path/to/haii-stations.json',
    '--tmd=path/to/tmd-stations.json',
    '--out=path/to/output',
  );
	return;
}

function generatStationScoring(station) {
  const scoring = [];

  let maxRiskScore = 0;

  if (station.hasRunOff) {
    const scoring = generateHydrologyScoring(station);
    scoring.push(scoring);

    if (scoring.riskScore > maxRiskScore) {
      maxRiskScore = scoring.riskScore;
    }
  }

  if (station.hasRainFall) {
    const scoring = generateMeteorologyScoring();
    scoring.push(scoring);

    if (scoring.riskScore > maxRiskScore) {
      maxRiskScore = scoring.riskScore;
    }
  }

  if (maxRiskScore > 0) {
    scoring.push({
      type: 'integration',
      riskScore: maxRiskScore,
    });
  }

  return scoring;
}

const importedStationsByProvince = {};
if (argv.haii) {
  const stations = require(argv.haii);
  stations.forEach((station) => {
    const provinceCode = station.province_code;
    if (!(provinceCode in importedStationsByProvince)) {
      importedStationsByProvince[provinceCode] = [];
    }

    const stations = importedStationsByProvince[provinceCode];
    stations.push({
      id: station.station_id,
      name: station.name_th,
      latitude: station.latitude,
      longitude: station.longitude,
      provinceCode: station.province_code,
      owner: station.owner,
      hasRainFall: station.can_measure_rain_fall === 'Y',
      hasRunOff: station.can_measure_run_off === 'Y',
    });
  });
}

if (argv.tmd) {
  const stations = require(argv.tmd);
  stations.forEach((station) => {
    const provinceCode = station.province_code;
    if (!(provinceCode in importedStationsByProvince)) {
      importedStationsByProvince[provinceCode] = [];
    }

    const stations = importedStationsByProvince[provinceCode];
    stations.push({
      id: station.station_id,
      wmoCode: station.wmo_code,
      name: station.name_th,
      latitude: station.latitude,
      longitude: station.longitude,
      provinceCode: station.province_code,
      owner: station.owner,
      hasRainFall: true,
      hasRunOff: false,
    });
  })
}

const inputData = require(argv.province);
const outputData = {
  type: 'integration',
  date: new Date(),
	provinces: [],
	riskScoreLegends: [{
		color: '#64dd17',
		min: 0,
		max: 30,
		level: 0,
		label: 'แจ้งข่าว'
  },
  {
		color: '#0065a3',
		min: 31,
		max: 50,
		level: 1,
		label: 'เผ้าระวัง'
  },
  {
		color: '#ffeb3b',
		min: 51,
		max: 80,
		level: 2,
		label: 'แจ้งเตือน'
  },
  {
		color: '#ff9800',
		min: 81,
		max: 90,
		level: 3,
		label: 'ให้อพยพ'
  },
  {
		color: '#dd2c00',
		min: 91,
		max: 100,
		level: 4,
		label: 'ต้องอพยพ'
	}],
};

inputData.forEach((province) => {
  province.scoring = [];
  province.stations = [];

  // Stations.
  const importedStations = importedStationsByProvince[province.info.provinceCode];
  if (importedStations) {
    importedStations.forEach((station) => {
      const scoring = generatStationScoring(station);
      
      if (scoring) {
        station.scoring = scoring;
      }

      province.stations.push({
        ...station,
      });
    });
  }

  // Warning News.
  const totalNews = Math.max(getRndInteger(0, 10) - 5, 0);
  let totalDistricts = 0;
  let newsLeft = totalNews;

  while (newsLeft > 0) {
    const subtract = getRndInteger(1, 3);
    newsLeft = newsLeft - subtract;
    totalDistricts += 1;
  }

  const colorValue =
    (totalDistricts === 0) ? 2 :
    (totalDistricts === 1) ? 4 :
    (totalDistricts === 2) ? 6 :
    (totalDistricts === 3) ? 8 :
    (totalDistricts > 3) ? 10 : 0;

  const riskScore = colorValue * 10;

  if (totalNews > 0) {
    province.warningNews = {
      totalDistricts,
      totalNews,
      riskScore,
    }
  }

  // Province scoring.
  const scoringData = [];
  province.stations.forEach((station) => {
    if (station.scoring) {
      station.scoring.forEach((score) => {
        scoringData.push(score);
      })
    }
  });

  const hydrologyRiskScore = scoringData
    .filter(score => score.type === 'hydrology')
    .reduce((max, score) => Math.max(max, score.riskScore), 0);

  const hydrologyRunOff = scoringData
    .filter(score => score.type === 'hydrology')
    .reduce((max, score) => Math.max(max, score.percentRunOff), 0);

  const meteorologyRiskScore = scoringData
    .filter(score => score.type === 'meteorology')
    .reduce((max, score) => Math.max(max, score.riskScore), 0);

  const meteorologyLeaveDays = scoringData
    .filter(score => score.type === 'meteorology')
    .reduce((max, score) => Math.max(max, score.leaveDays), 0);

  const socioRiskScore = province.warningNews && province.warningNews.riskScore || 0;
  const socioTotalDistricts = province.warningNews && province.warningNews.totalDistricts || 0;

  const integrationRiskScore = Math.max(
    hydrologyRiskScore, meteorologyRiskScore, socioRiskScore);

  province.scoring.push({
    type: 'integration',
    riskScore: integrationRiskScore,
  });

  if (hydrologyRiskScore !== null) {
    province.scoring.push({
      type: 'hydrology',
      riskScore: hydrologyRiskScore,
      percentRunOff: hydrologyRunOff,
    })
  }

  if (hydrologyRiskScore !== null) {
    province.scoring.push({
      type: 'meteorology',
      riskScore: meteorologyRiskScore,
      leaveDays: meteorologyLeaveDays,
    })
  }

  if (socioRiskScore !== null) {
    province.scoring.push({
      type: 'socioeconomics',
      riskScore: socioRiskScore,
      totalDistricts: socioTotalDistricts,
    })
  }

  outputData.provinces.push(province);
});

fs.writeFileSync(argv.out, JSON.stringify(outputData, null, 2));