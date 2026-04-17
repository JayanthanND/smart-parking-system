import React, { useState, useEffect, createContext, useContext } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

const SnackbarContext = createContext();

export const SnackbarProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);

  const showSnackbar = (message, type = 'info') => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, message, type }]);
  };

  const removeSnackbar = (id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <div className="snackbar-container">
        {alerts.map(alert => (
          <SnackbarItem key={alert.id} alert={alert} onRemove={() => removeSnackbar(alert.id)} />
        ))}
      </div>
    </SnackbarContext.Provider>
  );
};

export const useSnackbar = () => useContext(SnackbarContext);

const SnackbarItem = ({ alert, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(onRemove, 4000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle size={16} />,
    error: <XCircle size={16} />,
    warning: <AlertTriangle size={16} />,
    info: <Info size={16} />
  };

  return (
    <div className={`snackbar-item ${alert.type}`} onClick={onRemove}>
      <span className="snackbar-icon">{icons[alert.type]}</span>
      <span className="snackbar-message">{alert.message}</span>
    </div>
  );
};
