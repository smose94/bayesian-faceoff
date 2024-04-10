import React from 'react';
import { Box, Heading } from '@chakra-ui/react';

// Define the boxStyles object
export const boxStyles = {
  border: "2px dashed",
  borderColor: "gray.200",
  borderRadius: "md",
  p: 5,
  h: "400px", // Set a height for the placeholder
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

export default function Dashboard() {
  return (
    <div>
      <Heading mb={4}>Welcome to Bayesian Faceoff.</Heading>
    </div>
  );
}

