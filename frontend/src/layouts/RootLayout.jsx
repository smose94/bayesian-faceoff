import { Outlet } from "react-router-dom";
import { Flex, Box, Grid, GridItem, Text } from '@chakra-ui/react';
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function RootLayout() {
  return (
    <Grid templateColumns="repeat(6, 1fr)" bg="gray.50" minHeight="100vh">
      <GridItem colSpan={6}>
        <Navbar />
      </GridItem>
      <GridItem
        as="aside"
        colSpan={1}
        bg="teal.300"
        minHeight="calc(100vh - 64px)" // Assuming Navbar height is 64px
        w="225px"
        p="20px"
      >
        <Sidebar />
      </GridItem>
      <GridItem colSpan={5} p={4}>
        <Outlet />
      </GridItem>
      <GridItem colSpan={6} as="footer" bg="white.300" p={4} textAlign="center">
        <Text>&copy; {new Date().getFullYear()} Simon Moseley. All rights reserved.</Text>
      </GridItem>
    </Grid>
  );
}

