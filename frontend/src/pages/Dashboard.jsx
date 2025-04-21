import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Heading, 
  SimpleGrid, 
  Text, 
  Flex, 
  Stat, 
  StatLabel, 
  StatNumber, 
  StatHelpText, 
  Icon,
  useColorModeValue
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import supabase from '../supabaseClient';
import { FaHockeyPuck, FaChartLine, FaTrophy } from 'react-icons/fa';
import * as d3 from 'd3';

export default function Dashboard() {
  const [topTeams, setTopTeams] = useState({ offensive: [], defensive: [], points: [] });
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorderColor = useColorModeValue('gray.200', 'gray.700');
  const linkHoverColor = useColorModeValue('teal.500', 'teal.300');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get latest 32 records from team_strengths (ordered by Date descending)
        const { data: strengthsData, error: strengthsError } = await supabase
          .from('team_strengths')
          .select('*')
          .order('Date', { ascending: false })
          .limit(32);
        
        // Get latest 32 records from team_points (ordered by Date descending)
        const { data: pointsData, error: pointsError } = await supabase
          .from('team_points')
          .select('*')
          .order('date', { ascending: false })
          .limit(32);
        
        if (strengthsError || pointsError) {
          console.error('Error fetching data:', strengthsError || pointsError);
          setLoading(false);
          return;
        }
        
        // Get top 3 offensive teams from the latest 32 records
        const topOffensiveTeams = [...strengthsData]
          .sort((a, b) => b['Mean Attack Rating'] - a['Mean Attack Rating'])
          .slice(0, 3);
        
        // Get top 3 defensive teams from the latest 32 records
        const topDefensiveTeams = [...strengthsData]
          .sort((b, a) => b['Mean Defense Rating'] - a['Mean Defense Rating'])
          .slice(0, 3);
        
        // Process points data for top 3 teams
        const processedPointsData = pointsData.map(item => {
          // Parse points string to array and calculate mean
          const pointsArray = JSON.parse(item.points.replace(/'/g, '"'));
          const sum = pointsArray.reduce((acc, val) => acc + Number(val), 0);
          const mean = sum / pointsArray.length;
          
          return {
            ...item,
            meanPoints: parseFloat(mean.toFixed(1))
          };
        }).sort((a, b) => b.meanPoints - a.meanPoints).slice(0, 3);
        
        // Get latest update timestamp
        if (strengthsData && strengthsData.length > 0) {
          setLatestUpdate(new Date(strengthsData[0].Date));
        }
        
        // Set state with top teams
        setTopTeams({
          offensive: topOffensiveTeams,
          defensive: topDefensiveTeams,
          points: processedPointsData
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error in fetchData:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  
  const StatCard = ({ title, value, icon, helpText }) => (
    <Stat
      px={4}
      py={5}
      bg={cardBg}
      shadow="base"
      borderWidth="1px"
      borderColor={cardBorderColor}
      rounded="lg"
      transition="transform 0.3s"
      _hover={{ transform: 'translateY(-5px)', shadow: 'lg' }}
    >
      <Flex justifyContent="space-between">
        <Box>
          <StatLabel fontSize="sm" fontWeight="medium" isTruncated>
            {title}
          </StatLabel>
          <StatNumber fontSize="2xl" fontWeight="bold">
            {value}
          </StatNumber>
          {helpText && (
            <StatHelpText fontSize="sm">{helpText}</StatHelpText>
          )}
        </Box>
        <Box
          my="auto"
          color="gray.500"
          alignContent="center"
        >
          <Icon as={icon} w={8} h={8} />
        </Box>
      </Flex>
    </Stat>
  );

  const FeatureCard = ({ title, icon, description, link }) => (
    <Box
      as={Link}
      to={link}
      p={5}
      shadow="md"
      borderWidth="1px"
      borderColor={cardBorderColor}
      borderRadius="lg"
      bg={cardBg}
      transition="all 0.3s"
      _hover={{
        transform: 'translateY(-5px)',
        shadow: 'lg',
        borderColor: linkHoverColor,
      }}
    >
      <Flex align="center" mb={3}>
        <Icon as={icon} boxSize={6} mr={2} color="teal.500" />
        <Heading fontSize="xl">{title}</Heading>
      </Flex>
      <Text>{description}</Text>
    </Box>
  );

  const TeamRankingList = ({ teams, metric, title, isPoints = false }) => (
    <Box
      p={5}
      shadow="md"
      borderWidth="1px"
      borderColor={cardBorderColor}
      borderRadius="lg"
      bg={cardBg}
      height="100%"
    >
      <Heading size="md" mb={4}>{title}</Heading>
      {teams && teams.length > 0 ? (
        teams.map((team, idx) => (
          <Flex 
            key={idx} 
            justify="space-between" 
            align="center" 
            py={2}
            borderBottomWidth={idx < teams.length - 1 ? "1px" : "0"}
            borderColor="gray.200"
          >
            <Text fontWeight="bold">
              {idx + 1}. {team.Team || team.team}
            </Text>
            <Text>
              {isPoints ? 
                team.meanPoints : 
                parseFloat(team[metric]).toFixed(2)}
            </Text>
          </Flex>
        ))
      ) : (
        <Text>Loading data...</Text>
      )}
    </Box>
  );

  return (
    <Box p={5}>
      <Heading as="h1" size="xl" mb={6} color="teal.600">
        Welcome to Bayesian Faceoff
      </Heading>
      
      <Text mb={8} fontSize="lg" color="gray.600">
        Statistical analysis and projections for NHL teams based on Bayesian Bradley-Terry model
      </Text>
      
      {latestUpdate && (
        <Text fontSize="sm" color="gray.500" mb={8}>
          Last updated: {latestUpdate.toLocaleDateString()} at {latestUpdate.toLocaleTimeString()}
        </Text>
      )}
      
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10} mb={10}>
        <FeatureCard
          title="Team Performance"
          icon={FaHockeyPuck}
          description="View offensive and defensive strength ratings for all NHL teams"
          link="/performance"
        />
        <FeatureCard
          title="Season Projections"
          icon={FaChartLine}
          description="See projected points and playoffs probability for each team"
          link="/projections"
        />
        <FeatureCard
          title="Coming Soon: Matchups"
          icon={FaTrophy}
          description="Get win probabilities for upcoming games based on our model"
          link="/dashboard"
        />
      </SimpleGrid>
      
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
        <TeamRankingList 
          teams={topTeams.offensive} 
          metric="Mean Attack Rating" 
          title="Top Offensive Teams" 
        />
        <TeamRankingList 
          teams={topTeams.defensive} 
          metric="Mean Defense Rating" 
          title="Top Defensive Teams" 
        />
        <TeamRankingList 
          teams={topTeams.points} 
          isPoints={true}
          title="Highest Projected Points" 
        />
      </SimpleGrid>
    </Box>
  );
}