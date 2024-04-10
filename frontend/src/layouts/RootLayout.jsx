import { Outlet } from "react-router-dom"
import { Flex, Box, Grid, GridItem } from '@chakra-ui/react';
import Navbar from "../components/Navbar"
import Sidebar from "../components/Sidebar";

export default function RootLayout() {
  return (

    <Grid templateColumns="repeat(6, 1fr)" bg="gray.50">
      <GridItem colSpan={6}>
        <Navbar/>
      </GridItem>
      <GridItem
      as="aside"
      colSpan={1} bg="teal.300" minHeight="100vh" w="225px" justifyContent="center" p="20px">
        <Sidebar />

      </GridItem>

      <GridItem
      colSpan={5}>
        <Outlet />
      </GridItem>

    </Grid>
  )
}
