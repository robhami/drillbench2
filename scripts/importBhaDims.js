const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const inputPath = path.resolve(
  __dirname,
  '../datasource/componentDB.xlsx'
);

const outputPath = path.resolve(
  __dirname,
  '../src/data/components.json'
);

const normaliseText = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/\s+/g, ' ');
};

const numberOrNull = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
};

const getCategory = (name) => {
  const upperName = normaliseText(name).toUpperCase();

  if (upperName.startsWith('BIT')) return 'BIT';
  if (upperName.startsWith('DC')) return 'DC';
  if (upperName.startsWith('DP')) return 'DP';
  if (upperName.startsWith('HWDP')) return 'HWDP';
  if (upperName.startsWith('JAR')) return 'JAR';
  if (upperName.startsWith('MILL')) return 'MILL';
  if (upperName.startsWith('MLWD')) return 'M_LWD';
  if (upperName.startsWith('MWD')) return 'M_LWD';
  if (upperName.startsWith('LWD')) return 'M_LWD';
  if (upperName.startsWith('MOTOR')) return 'RSS_MTR';
  if (upperName.startsWith('RSS')) return 'RSS_MTR';
  if (upperName.startsWith('NMDC')) return 'DC';
  if (upperName.startsWith('STB')) return 'STB';
  if (upperName.startsWith('SUB')) return 'SUB_XO';
  if (upperName.startsWith('XO')) return 'SUB_XO';
  if (upperName.startsWith('REAMER')) return 'OTHER';
  if (upperName.startsWith('ROLLER RMR')) return 'OTHER';
  if (upperName.startsWith('RT')) return 'OTHER';
  if (upperName.startsWith('SHOCK')) return 'OTHER';
  if (upperName.startsWith('UBHO')) return 'OTHER';

  return 'OTHER';
};

const makeId = (prefix, rowNumber) =>
  `${prefix.toLowerCase()}-${rowNumber}`;

if (!fs.existsSync(inputPath)) {
  throw new Error(
    `Input file not found: ${inputPath}`
  );
}

const workbook = XLSX.readFile(inputPath, {
  cellDates: false,
  cellFormula: true
});

const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];

if (!worksheet) {
  throw new Error(
    'No worksheet was found in componentDB.xlsx.'
  );
}

const rows = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  defval: null,
  raw: true
});

const components = [];

/*
 * Block 1: columns A-I
 * Primarily drill-pipe records.
 */
for (let index = 1; index < rows.length; index += 1) {
  const row = rows[index];
  const name = normaliseText(row[0]);

  if (!name) {
    continue;
  }

  components.push({
    id: makeId('pipe', index + 1),
    category: getCategory(name),
    name,

    od: numberOrNull(row[1]),
    idSize: numberOrNull(row[2]),
    weight: numberOrNull(row[3]),
    nominalWeight: numberOrNull(row[5]),

    connectionTop: normaliseText(row[4]),
    connectionBottom: normaliseText(row[4]),

    toolJointOd: numberOrNull(row[6]),
    toolJointId: numberOrNull(row[7]),
    grade: normaliseText(row[8]),

    length: null,
    totalWeight: null,
    manufacturer: '',

    sourceSheet: firstSheetName,
    sourceRow: index + 1
  });
}

/*
 * Block 2: columns L-Z
 * BHA tools, jars, motors, stabilizers,
 * subs, crossovers and related components.
 */
for (let index = 1; index < rows.length; index += 1) {
  const row = rows[index];
  const name = normaliseText(row[11]);

  if (!name) {
    continue;
  }

  components.push({
    id: makeId('bha', index + 1),
    category: getCategory(name),
    name,

    od: numberOrNull(row[12]),
    idSize: numberOrNull(row[13]),
    weight: numberOrNull(row[14]),
    nominalWeight: numberOrNull(row[16]),

    connectionTop: normaliseText(row[15]),
    connectionBottom: normaliseText(row[22]),

    toolJointOd: numberOrNull(row[17]),
    toolJointId: numberOrNull(row[18]),

    stabilizerOd: numberOrNull(row[19]),
    stabilizerPosition: normaliseText(row[20]),
    stabilizerType: normaliseText(row[21]),

    crossoverTo: normaliseText(row[22]),

    length: numberOrNull(row[23]),
    totalWeight: numberOrNull(row[24]),
    manufacturer: normaliseText(row[25]),

    grade: '',

    sourceSheet: firstSheetName,
    sourceRow: index + 1
  });
}

const usableComponents = components.filter(
  (component) =>
    component.name &&
    component.od !== null
);

const categoryCounts = usableComponents.reduce(
  (counts, component) => {
    counts[component.category] =
      (counts[component.category] || 0) + 1;

    return counts;
  },
  {}
);

const output = {
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(inputPath),
  sourceSheet: firstSheetName,
  componentCount: usableComponents.length,
  categoryCounts,
  components: usableComponents
};

fs.mkdirSync(path.dirname(outputPath), {
  recursive: true
});

fs.writeFileSync(
  outputPath,
  JSON.stringify(output, null, 2),
  'utf8'
);

console.log(`Created: ${outputPath}`);
console.log(
  `Imported ${usableComponents.length} components.`
);
console.table(categoryCounts);