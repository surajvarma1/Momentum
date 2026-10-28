/**
 * React context for providing the ServiceContainer to the app.
 */

import React, { createContext, useContext } from 'react';
import { ServiceContainer } from '../../services/ServiceContainer';

const ServiceContext = createContext<ServiceContainer | null>(null);

interface ServiceProviderProps {
  container: ServiceContainer;
  children: React.ReactNode;
}

export function ServiceProvider({ container, children }: ServiceProviderProps) {
  return React.createElement(ServiceContext.Provider, { value: container }, children);
}

export function useServices(): ServiceContainer {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
}
