// @ts-nocheck -- vendored third-party (chris24elias/react-native-page-flipper), patched for Reanimated 4
import React from 'react';
import { LinearGradient, LinearGradientProps } from 'expo-linear-gradient';

// Vendored patch: the upstream package used `react-native-linear-gradient`.
// AdabiyotX ships `expo-linear-gradient`, so native + web both use it here.
const Gradient: React.FC<LinearGradientProps> = (props) => {
    return <LinearGradient {...props} />;
};

export { Gradient };
