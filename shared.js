function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1) ) + min;
}

function generateHydrologyScoring() {
  const percentRunOff = getRndInteger(11, 100);
  const colorValue = 
    (percentRunOff > 50) ? 2 :
    (percentRunOff > 30) ? 4 :
    (percentRunOff > 10) ? 6 : 0;

  const riskScore = colorValue * 10;

  return {
    type: 'hydrology',
    riskScore,
    percentRunOff,
  };
}

function generateMeteorologyScoring() {
  let riskLevel = getRndInteger(1, 5);
  let retryCount = 0;
  while (riskLevel > 1 && retryCount < 20) {
    riskLevel = getRndInteger(1, 5);
    retryCount += 1;
  }

  const leaveDays =
    (riskLevel === 1) ? getRndInteger(0, 15) :
    (riskLevel === 2) ? getRndInteger(16, 30) :
    (riskLevel === 3) ? getRndInteger(31, 90) :
    (riskLevel === 4) ? getRndInteger(91, 150) :
    (riskLevel === 5) ? getRndInteger(151, 200) : 0;

  const riskScore = riskLevel * 2 * 10;

  return {
    type: 'meteorology',
    leaveDays,
    riskScore,
  };
}

function getMeteorologyRiskScore(leaveDays) {
  if (leaveDays >= 0 && leaveDays <= 15) {
    return 20;
  } else if (leaveDays > 16 && leaveDays <= 30) {
    return 40;
  } else if (leaveDays > 31 && leaveDays <= 90) {
    return 60;
  } else if (leaveDays > 91 && leaveDays <= 150) {
    return 80;
  } else if (leaveDays > 151) {
    return 100;
  }

  return 0;
}

function getHydrologyRiskScore(percentRunOff) {
  const colorValue = 
    (percentRunOff > 50) ? 2 :
    (percentRunOff > 30) ? 4 :
    (percentRunOff > 10) ? 6 : 0;
  
  return colorValue * 10;
}

function getSocioeconomicsRiskScore(totalDistricts) {
  const colorValue =
    (totalDistricts === 0) ? 2 :
    (totalDistricts === 1) ? 4 :
    (totalDistricts === 2) ? 6 :
    (totalDistricts === 3) ? 8 :
    (totalDistricts > 3) ? 10 : 0;

  return colorValue * 10;
}

module.exports = {
  getRndInteger,
  generateHydrologyScoring,
  generateMeteorologyScoring,
  getMeteorologyRiskScore,
  getHydrologyRiskScore,
  getSocioeconomicsRiskScore,
};
