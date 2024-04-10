import React from 'react';
import { Flex, Box, Text, Link, Icon } from '@chakra-ui/react';
import { FaGithub } from 'react-icons/fa';

function Navbar() {
  return (
    <Flex as="nav" bg='teal.300' align="center" justifyContent="space-between" wrap="wrap" p={0} height="60px">
      {/* Ensure Box fills the height of the Flex container */}
      <Box bg='teal.400' display="flex" alignItems="center" height="100%" w="225px" justifyContent="center">
        <Text  color="white" fontSize="25" fontWeight="bold">Bayesian Faceoff</Text>
      </Box>
      <Link href="https://github.com/smose94/bayesian-faceoff" isExternal>
        <Icon as={FaGithub} boxSize={6} mr="20px" color="white" />
      </Link>
    </Flex>
  );
}

export default Navbar;