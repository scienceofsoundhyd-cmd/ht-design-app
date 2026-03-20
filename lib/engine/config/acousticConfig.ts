export type SeverityWeights = {
  readonly modeCountWeight: number;
  readonly bandwidthWeight: number;
  readonly densityWeight: number;
};

export type PriorityThresholds = {
  readonly critical: number;
  readonly high: number;
  readonly moderate: number;
};

export type AcousticEngineConfig = {
  readonly matchToleranceHz: number;
  readonly schroederConstant: number;
  readonly modalRegionSplitFactor: number;
  readonly temperatureCelsius: number;
  readonly relativeHumidity: number;
  readonly severityWeights: SeverityWeights;
  readonly priorityThresholds: PriorityThresholds;
};

export const DEFAULT_ACOUSTIC_CONFIG: AcousticEngineConfig = {
  matchToleranceHz: 1e-9,
  schroederConstant: 2000,
  modalRegionSplitFactor: 0.5,
  temperatureCelsius: 20,
  relativeHumidity: 50,
  severityWeights: {
    modeCountWeight: 1,
    bandwidthWeight: 1,
    densityWeight: 1,
  },
  priorityThresholds: {
    critical: 0.75,
    high: 0.5,
    moderate: 0.25,
  },
};