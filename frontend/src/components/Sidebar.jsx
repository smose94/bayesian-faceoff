import React from 'react';
import { List, ListItem, Link, Icon, Flex, Text } from '@chakra-ui/react';
import { FiHome, FiTarget, FiBarChart2 } from 'react-icons/fi'; // Importing icons

function SidebarLinks() {
  return (
    <List spacing={4} fontWeight="Bold" color="white">
      {/* Home Link */}
      <ListItem>
        <Link href="/" display="flex" alignItems="center">
          <Icon as={FiHome} mr={2} />
          <Text>Home</Text>
        </Link>
      </ListItem>

      {/* Team Performance Link */}
      <ListItem>
        <Link href="/performance" display="flex" alignItems="center">
          <Icon as={FiTarget} mr={2} />
          <Text>Team Performance</Text>
        </Link>
      </ListItem>

      {/* Point Projections Link */}
      <ListItem>
        <Link href="/projections" display="flex" alignItems="center">
          <Icon as={FiBarChart2} mr={2} />
          <Text>Point Projections</Text>
        </Link>
      </ListItem>

      {/* Add more links as needed */}
    </List>
  );
}

export default SidebarLinks;
