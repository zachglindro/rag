Here were the queries performed on each system:
1.  resistant to calcareous soil
2.  resistant to calcerous soil - misspelling
3.  early maturing
4.  suitable for early harvest.
5.  purple anther colors.
6.  ear length greater than 10 cm
7.  high yielding
8.  tight husk fitting
9.  good in very dry soil
10. resistant to drought
11. can handle saturated or flooded soil
12. tolerant to waterlogging
13. shows resistance to ear rot
14. red cob color
15. white cob color
16. resistant to common diseases
17. BT negative Bagtikan
18. purple silk color
19. plant height between 200 and 250 cm
20. more than 13 rows of grain

These metrics were then recorded for both the hybrid search and the keyword search, which used BM25:
Precision@k - The proportion of retrieved records in the top-k results that are relevant to the user's query.
Recall@k - The proportion of all relevant records in the dataset that are successfully retrieved within the top-k results.
Mean Average Precision (MAP) - The mean of the Average Precision (AP) scores across all test queries. This metric evaluates the quality of the ranking order, penalizing the system if relevant parental lines appear lower down in the search results.

These were the aggregated metrics:

Search,Precision5,Precision10,Precision20,Recall5,Recall10,Recall20,MAP
Hybrid,0.44,0.38,0.315,0.09318,0.1169,0.1298,0.1134
Keyword,0.31,0.285,0.2275,0.09443,0.1258,0.1256,0.1241
