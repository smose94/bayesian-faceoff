import React, { createContext, useContext, useState } from 'react';

const DateContext = createContext();

export const useDate = () => useContext(DateContext);

export const DateProvider = ({ children }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));  // Default to current date

    return (
        <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
            {children}
        </DateContext.Provider>
    );
};
