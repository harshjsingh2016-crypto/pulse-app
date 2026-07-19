import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import OptionsSheet from '../components/OptionsSheet';
import CompletedTasksSheet from '../components/CompletedTasksSheet';
import AccountSheet from '../components/AccountSheet';
import HealthSheet from '../components/HealthSheet';
import ProviderSheet from '../components/ProviderSheet';

interface OptionsContextValue {
  openOptions: () => void;
}

const OptionsContext = createContext<OptionsContextValue>({ openOptions: () => {} });

export function OptionsProvider({ children }: { children: ReactNode }) {
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [completedVisible, setCompletedVisible] = useState(false);
  const [healthVisible, setHealthVisible] = useState(false);
  const [providerVisible, setProviderVisible] = useState(false);
  const [accountVisible, setAccountVisible] = useState(false);

  return (
    <OptionsContext.Provider value={{ openOptions: () => setOptionsVisible(true) }}>
      {children}
      <OptionsSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        onCompletedTasks={() => setCompletedVisible(true)}
        onHealth={() => setHealthVisible(true)}
        onProvider={() => setProviderVisible(true)}
        onAccount={() => setAccountVisible(true)}
        onSignOut={() => signOut(auth)}
      />
      <CompletedTasksSheet
        visible={completedVisible}
        onClose={() => setCompletedVisible(false)}
      />
      <HealthSheet
        visible={healthVisible}
        onClose={() => setHealthVisible(false)}
      />
      <ProviderSheet
        visible={providerVisible}
        onClose={() => setProviderVisible(false)}
      />
      <AccountSheet
        visible={accountVisible}
        onClose={() => setAccountVisible(false)}
      />
    </OptionsContext.Provider>
  );
}

export function useOptions() {
  return useContext(OptionsContext);
}
