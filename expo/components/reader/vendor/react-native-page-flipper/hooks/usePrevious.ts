// @ts-nocheck -- vendored third-party (chris24elias/react-native-page-flipper), patched for Reanimated 4
import { useEffect, useRef } from 'react';

// Hook
const usePrevious = <T>(value: T) => {
    // The ref object is a generic container whose current property is mutable ...
    // ... and can hold any value, similar to an instance property on a class
    const ref = useRef<T>();
    // Store current value in ref
    useEffect(() => {
        ref.current = value;
    }, [value]); // Only re-run if value changes
    // Return previous value (happens before update in useEffect above)
    return ref.current;
};
export default usePrevious;
