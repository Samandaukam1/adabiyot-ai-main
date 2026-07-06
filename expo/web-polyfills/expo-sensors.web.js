// Web stub for expo-sensors — accelerometer not available in browser
const noop = () => {};
const noSub = { remove: noop };

const Accelerometer = {
  setUpdateInterval: noop,
  addListener: () => noSub,
  removeAllListeners: noop,
  isAvailableAsync: async () => false,
};

const Gyroscope = {
  setUpdateInterval: noop,
  addListener: () => noSub,
  removeAllListeners: noop,
  isAvailableAsync: async () => false,
};

const DeviceMotion = {
  setUpdateInterval: noop,
  addListener: () => noSub,
  removeAllListeners: noop,
  isAvailableAsync: async () => false,
};

module.exports = { Accelerometer, Gyroscope, DeviceMotion };
