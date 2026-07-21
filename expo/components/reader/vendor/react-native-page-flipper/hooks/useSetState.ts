// @ts-nocheck -- vendored third-party (chris24elias/react-native-page-flipper), patched for Reanimated 4
import { useCallback, useState } from 'react';

// eslint-disable-next-line
const useSetState = <T extends object>(
    initialState: T = {} as T
): [T, (patch: Partial<T> | ((prevState: T) => Partial<T>)) => void] => {
    const [state, set] = useState<T>(initialState);
    const setState = useCallback(
        (patch) => {
            set((prevState) => ({
                ...prevState,
                ...(patch instanceof Function ? patch(prevState) : patch),
            }));
        },
        [set]
    );

    return [state, setState];
};

export default useSetState;
