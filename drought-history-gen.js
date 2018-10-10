const argv = require('minimist')(process.argv.slice(2));
const moment = require('moment');
const fs = require('fs');
const shared = require('./shared');

const {
  getRndInteger,
  getMeteorologyRiskScore,
  getHydrologyRiskScore,
  getSocioeconomicsRiskScore,
} = shared;

if (!argv.provinces || !argv.elevation || !argv.out) {
	console.info(
    'Usage: node drought-history-gen',
    '--provinces=path/to/provinces.json',
    '--elevation=path/to/station-elevations.json',
    '--out=path/to/output/folder',
  );
	return;
}

const elevation = require(argv.elevation);
const elevationLookup = elevation && elevation.reduce((lookup, station) => ({
  ...lookup,
  ...{
    [station.id]: station,
  }
}));

const stationPercentRunOffAccumulate = {};

const inputData = require(argv.provinces);
const stationLeaveDays = {};

inputData.forEach((province) => {
  const endDate = moment(new Date());
  const startDate = moment(endDate).add(-90, 'days');

  const outputData = {
    ...province.info,
    startDate: startDate.toDate(),
    endDate: endDate.toDate(),
    scorings: [],
  };
  
  const summaryByDay = [];
  const stationHistoryDataLookup = {};
  
  for (let date = startDate; date.isBefore(endDate); date.add(1, 'day')) {
    let hasAnyRainFall = false;
    province.scoring = [];

    // meteorology and hydrology
    province.stations.forEach((station) => {
      const stationScoring = []
      if (stationLeaveDays[station.id] === undefined) {
        stationLeaveDays[station.id] = Math.max(getRndInteger(0, 50) - 20, 0);
      }

      let maxRiskScore = 0;
      if (station.hasRainFall) {
        const hasRain = getRndInteger(0, 5) > 3;
        const rain = hasRain ? getRndInteger(1, 200) : 0;
        if (!hasRain) {
          stationLeaveDays[station.id]++;
        } else {
          stationLeaveDays[station.id] = 0;
          hasAnyRainFall = true;
        }

        const riskScore = getMeteorologyRiskScore(stationLeaveDays[station.id]);

        stationScoring.push({
          type: 'meteorology',
          leaveDays: stationLeaveDays[station.id],
          rain,
          riskScore,
        });

        if (maxRiskScore > riskScore) {
          maxRiskScore = riskScore;
        }
      }

      if (station.hasRunOff) {
        if (!stationPercentRunOffAccumulate[station.id]) {
          let percentRunOff = getRndInteger(10, 100);
  
          let retryCount = 0;
          while(percentRunOff < 50 && retryCount < 5) {
            percentRunOff = getRndInteger(10, 100);
            retryCount++;
          }

          stationPercentRunOffAccumulate[station.id] = percentRunOff;
        }

        const factor = getRndInteger(0, 1) - 1;
        const percentChanged = getRndInteger(0, 5) * factor;
        const percentRunOff = stationPercentRunOffAccumulate[station.id] + percentChanged;

        const gl = (elevationLookup[station.id] && elevationLookup[station.id].elevation) || 0;
        const bl = gl + getRndInteger(0, 5);
        const runOff= ((percentRunOff / 100) * (bl - gl)) + gl;
        const riskScore = getHydrologyRiskScore(percentRunOff)
        stationScoring.push({
          type: 'hydrology',
          runOff,
          percentRunOff,
          riskScore,
        });

        if (maxRiskScore > riskScore) {
          maxRiskScore = riskScore;
        }
      }

      if (station.hasRainFall || station.hasRunOff) {
        stationScoring.push({
          type: 'integration',
          riskScore: maxRiskScore,
        });
      }

      station.scoring = stationScoring;

      // Station scoring data.
      if (!stationHistoryDataLookup[station.id]) {
        stationHistoryDataLookup[station.id] = {
          ...station,
          scorings: [],
        };
      }

      const stationScoringDataList = stationHistoryDataLookup[station.id].scorings;
      const scoringByType = station.scoring.reduce(
        (lookup, scoring) => ({
          ...lookup,
          ...{
            [scoring.type]: scoring,
          },
        }), {});
  
      const stationScoringData = {
        date: date.toDate(),
        riskScoreIntegration: (scoringByType.integration && scoringByType.integration.riskScore) || null,
      };  

      if (scoringByType.meteorology) {
        stationScoringData.riskScoreMeteorology = scoringByType.meteorology.riskScore;
        stationScoringData.leaveDays = scoringByType.meteorology.leaveDays;
        stationScoringData.rain = scoringByType.meteorology.rain;
      }
  
      if (scoringByType.hydrology) {
        stationScoringData.riskScoreHydrology = scoringByType.hydrology.riskScore;
        stationScoringData.percentRunOff = scoringByType.hydrology.percentRunOff;
        stationScoringData.runOff = scoringByType.hydrology.runOff;
      }

      stationScoringDataList.push(stationScoringData);
    });

    // socioeconomic.
    delete province.warningNews;
    if (!hasAnyRainFall) {
      const totalNews = Math.max(getRndInteger(0, 10) - 5, 0);
      let totalDistricts = 0;
      let newsLeft = totalNews;
    
      while (newsLeft > 0) {
        const subtract = getRndInteger(1, 3);
        newsLeft = newsLeft - subtract;
        totalDistricts += 1;
      }

      if (totalNews > 0) {
        province.warningNews = {
          totalDistricts,
          totalNews,
          riskScore: getSocioeconomicsRiskScore(totalDistricts),
        }
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

    const hydrologyScoring = scoringData.filter(score => score.type === 'hydrology');
    const hydrologyMaxRiskScoring = hydrologyScoring.length
      && hydrologyScoring.reduce(
        (prev, current) => prev.riskScore > current.riskScore ? prev : current
      );

    const hydrologyRiskScore = (hydrologyMaxRiskScoring && hydrologyMaxRiskScoring.riskScore) || 0;

    const meteorologyScoring = scoringData.filter(score => score.type === 'meteorology');
    const meteorologyMaxRiskScoring = meteorologyScoring.length
      && meteorologyScoring.reduce(
        (prev, current) => prev.riskScore > current.riskScore ? prev : current
      );

    const meteorologyRiskScore = meteorologyMaxRiskScoring.riskScore;

    const socioRiskScore = province.warningNews && province.warningNews.riskScore || 0;
    const socioTotalDistricts = province.warningNews && province.warningNews.totalDistricts || 0;
    const socioTotalNews = province.warningNews && province.warningNews.totalNews || 0;

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
        percentRunOff: hydrologyMaxRiskScoring && hydrologyMaxRiskScoring.percentRunOff,
        runOff: hydrologyMaxRiskScoring && hydrologyMaxRiskScoring.runOff,
      })
    }

    if (hydrologyRiskScore !== null) {
      province.scoring.push({
        type: 'meteorology',
        riskScore: meteorologyRiskScore,
        leaveDays: meteorologyMaxRiskScoring && meteorologyMaxRiskScoring.leaveDays,
        rain: meteorologyMaxRiskScoring && meteorologyMaxRiskScoring.rain,
      })
    }

    if (socioRiskScore !== null) {
      province.scoring.push({
        type: 'socioeconomics',
        riskScore: socioRiskScore,
        totalDistricts: socioTotalDistricts,
        totalNews: socioTotalNews,
      })
    }

    summaryByDay.push(JSON.parse(JSON.stringify(province)));


    const scoringByType = province.scoring.reduce(
      (lookup, scoring) => ({
        ...lookup,
        ...{
          [scoring.type]: scoring,
        },
      }), {});

    const provinceScoringData = {
      date: date.toDate(),
      riskScoreIntegration: scoringByType.integration.riskScore,
    };

    if (scoringByType.meteorology) {
      provinceScoringData.riskScoreMeteorology = scoringByType.meteorology.riskScore;
      provinceScoringData.leaveDays = scoringByType.meteorology.leaveDays;
      provinceScoringData.rain = scoringByType.meteorology.rain;
    }

    if (scoringByType.hydrology) {
      provinceScoringData.riskScoreHydrology = scoringByType.hydrology.riskScore;
      provinceScoringData.percentRunOff = scoringByType.hydrology.percentRunOff;
      provinceScoringData.runOff = scoringByType.hydrology.runOff;
    }

    if (scoringByType.socioeconomics) {
      provinceScoringData.riskScoreSocioeconomics = scoringByType.socioeconomics.riskScore;
      provinceScoringData.totalDistricts = scoringByType.socioeconomics.totalDistricts;
      provinceScoringData.totalNews = scoringByType.socioeconomics.totalNews;
    }

    outputData.scorings.push(provinceScoringData);
  }

  fs.writeFileSync(
    `${argv.out}/provinces/${province.info.provinceCode}.json`,
    JSON.stringify(outputData, null, 2)
  );

  Object.keys(stationHistoryDataLookup).forEach(key => {
    const data = stationHistoryDataLookup[key];
    delete data.leaveDays;
    delete data.rain;
    delete data.scoring;

    fs.writeFileSync(
      `${argv.out}/stations/${data.id}.json`,
      JSON.stringify(data, null, 2)
    );  
  });
});

const summary = {
  type: 'integration',
  date: new Date(),
  provinces: inputData,
  riskScoreLegends: [
    {
      "color": "#64dd17",
      "min": 0,
      "max": 30,
      "level": 0,
      "label": "แจ้งข่าว"
    },
    {
      "color": "#0065a3",
      "min": 31,
      "max": 50,
      "level": 1,
      "label": "เผ้าระวัง"
    },
    {
      "color": "#ffeb3b",
      "min": 51,
      "max": 80,
      "level": 2,
      "label": "แจ้งเตือน"
    },
    {
      "color": "#ff9800",
      "min": 81,
      "max": 90,
      "level": 3,
      "label": "ให้อพยพ"
    },
    {
      "color": "#dd2c00",
      "min": 91,
      "max": 100,
      "level": 4,
      "label": "ต้องอพยพ"
    }
  ]
}

fs.writeFileSync(
  `${argv.out}/summary.json`,
  JSON.stringify(summary, null, 2)
)