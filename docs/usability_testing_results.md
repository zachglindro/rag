These were the tasks performed for the five researchers:
1. Ingest a new dataset into the system. 
2. Create a new column named "Reviewed by" in the system, with a default value of "None". Then delete this column.
3. Update the record with APN 264 to have yellow kernel color and flint kernel type.
4. Perform searches for:
- parental lines that are located in Antique and have a Yellow Kernel Color. (This tested the Province and Kernel Color columns.)
 - parental lines that would be good for planting in flooded or very wet conditions and show some resistance to Downy Mildew. (This tested Waterlogging and Downy Mildew.)
- a variety that has orange/flint kernels with a local name of Calumpit (This tested Kernel Color and Local Name.)

Searches were performed in the system's home and edit pages, as well as Excel. The home page was used to talk to the Qwen3-0.6B LLM, which performed queries and synthesis on the user's behalf. The edit page was used to search the database directly, using ChromaDB (embeddings + reranker). Lastly, Excel was used to represent the users' current methods of accessing and searching the data.

Notes:
- The used dataset for usability testing was a subset of the provided dataset; the records in the dataset were picked so that all records in the database contained data for all queries in task 4.

The following were recorded: Participant, Task, System, Time taken (sec), Success (Y/N), Notes

---

User 1:
Chiara de la Pena
University Research Associate 2

Task 1: Y
Task 2: Y
Task 3: Y

Task 4:
Query 1:
- LLM: Yes. 35.56s for the initial results from the db popped up, 59.16 seconds for the LLM to respond
- Direct search: Yes. 26.12s taken, but the search results contained different, irrelevant provinces.
- Excel: Yes. 01:56.99 to complete. They used the filter function; it was more precise, but the Excel UI was finicky.

Query 2:
- LLM: No. Stopped at 4:05.00. In the search results, the "Tolerant" values for the Waterlogging column was surfaced. However, the surfaced values for the Downy Mildew column all contained "Susceptible", which was the opposite result expected.
- Direct search: No, stopped at 3:39.56. The main problem: people seemed to assume the search function behaved like a chat feature. It was as if they were talking to the search function, e.g. "search for [X]". Their searches were also not minimal, as said before. Like the LLM, the values for the Downy Mildew here all contained "Susceptible.
- Excel: Yes, performed in 37.91. The caveat here is that I explicitly told them that the expected column to be tested/queried was Waterlogging, so they knew which column/s to filter.

Query 3:
- LLM: Yes. It took 45.49 for the initial results from the db, then the LLM generation at 1:24.10
- Direct search: Yes, performed in 36.14 s. However, the desired result was not actually the first result (it was further down in the search results).
- Excel: Yes, 26.70 s. They used Excel's filter feature. A good thing to note here though was that they updated the filters because they initially only included the orange filter, but included also "orange/red" as they discovered that that was also a value.

Task 5: Y

Their comments: It was more natural to actually use Excel, as it provided better results. The main issue in the system was the accuracy of its surfaced results. The summarization provided by the LLM was adequate; it was based on the search results, and there were no hallucinations generated.

---

User 2
Elaine Navasero
University Research Associate 1

(Note: there was a bug in the ingestion feature here, so I had to refresh the page.)

Task 1: Y
Task 2: The Add New Column button/feature in the context menu wasn't immediately obvious. I had to guide them to the Add Column button, but otherwise they managed to do it.
Task 3: Y. Although they did have to find the Save Changes button for a bit.

Task 4:

Query 1:
- LLM: Y, performed in 3:07.69. There were records that satisfed the result, but they weren't on the top of the results list. Also, records not relevant to the result were surfaced. Problem: the query performed by the system was actually "Yellow kernel color" which is pretty incomplete. In the second query, it was then ok.
- Direct search: Y, in 1:06.53. Again the results weren't perfectly accurate.
- Excel: Y, in 1:55.31. Although they were not familiar with Excel's UI, more particularly around the location of the filter button.

Query 2:
- LLM: N, stopped at 4:18.27. The main issue: the database was not using its given search db tool, so they resorted to include the phrases "from the uploaded database" or "search this in db". They did manage to find records which included tolerant to waterlogging in 1:57.44, but the same issue arose in that these had downy mildew susceptible values.
- Direct search: N, stopped at 58.27. Same issues: tolerant to waterlogging, susceptible to downy mildew types of records.
- Excel: Y, in 59.53. They used the filter function.

Query 3
- LLM: Y. Initial results from the db were at 1:00.39, then the LLM generated text/summary at 1:43.52. Again, they used "from the database" here. In some chats, the system was not using the given search db tool. The query made by the system was also incomplete: it only searched for "Calumpit". lang second query. 
- Direct search: Y, in 44.83, although the results were not ordered correctly, i.e. the expected results were further down the list of search results. I'd like to note that the user's search here was not minimal.
- Excel: Y, in 32.76 s.

Task 5: Y

---

User 3
Kimberly Calibo
Project Technical Aide 5

Task 1: Y
Task 2: Y, although I had to guide them. They confused the Add Filter button with the supposed task, add column. So I had to guide them in right clicking within the table's headers.
Task 3: Y, although they had to find the Save Changes button.

Task 4:

Query 1
- LLM: N, stopped at 5:00. The system's query was completely incorrect; it searched for "parental_query". When the user included the "search for" term, it wasn't even using the search db tool. indi lumabas pag walang "search for", i.e. sinearch lang niya yung query. stopped at 5 minis
- Direct search: Y, in 1:30.32. Issue here was that the result expected to be surfaced did surface, but it wasn't the top 1 result
- Excel: Y, in 39.12.

Query 2
- LLM: N, stopped at 4:27.25. Again, it was searching here "parental_lines". And when it did perform a correct search, the same issue arose in that waterlogging tolerant records but susceptible to downy mildew records were being surfaced.
- Direct search: N, stopped at 46.52. This was pretty quick because the same issue above arose.
- Excel: Y, in 1:18.63, although it did look like they weren't familiar with Excel's UI.

Query 3
- LLM: Y, in 1:49.11. Note: the LLM was not using the search db tool when the user's message/query was plain, i.e. "varieties that have [X] and [Y]. Here the top first results satisfied the query, although we actually expected 3 correct records here.
- Direct search: Y, in 1:03.07. Same issue as above.
- Excel: Y, in 26.04. But they had to find filter button. 

Task 5 - Y

Their comments: Some of the columns needed to check the results were far apart from each other. This meant they wanted to "zoom out" or scale down the table, but couldn't.

---

User 4
Maria Alma Sanchez
University Researcher

Task 1: Y
Task 2: They confused the Add Filter feature with the Add New Column. They tried to find it in the Settings page (it's not there). They also tried the Edit feature; it also wasn't there (maybe it should be?). I had to guide them to the Add Column button in the context menu, but they were ok after that.
Task 3: Y, but very labored. They couldn't find it because they were on another page. So they tried to use search to find APN 264, but it didn't appear. Then they cleared the search and they found it because it restarted to the first page. Everything was ok after that.

Task 4:

Query 1:
LLM: N, stopped at 5 mins. Again, the LLM was not using the search db tool. They kind of had to find the New Chat butto.. They were only able to surface the results when I guided them to chat "Search for [X]".
Direct search: Y, in 41.75s. Although like the others, the results had Iloilo may halong iloilo, had red and orange color. But they did find records, I guess.
Excel: Y, in 1:49.20. Interestingly, they like to use the sort feature to find records. So they sorted for province, found the records containing Antique, and scanned for yellow kernels.

Query 2:
LLM: N, results surfaced in 55 s, same issue: tolerant to waterlogging, but susceptible to downy mildew. Stopped at 1:30, because they were running into the same issues essentially.
Direct search: N, stopped at 30s. They found the tolerant to waterloggin records, but susceptible to downy mildew records were also being surfaced.
Excel: Y, in 1:20.97. Again, they used the sort feature for this.

Query 3:
LLM: Y, in 1:19.67. The LLM (AGAIN) did not use the search db tool. However, once the user updated their chat, it did query the db, but again results contained the results, but were essentially mixed.
Direct search: Y, in 30.62 s. Same issues: surfaced results, but they were not near the top (i.e. at the middle or the bottom) of the search results.
Excel: Y, in 38.07 s. Again they used sort here.

Task 5: Y

Comments: Add an explicit Add Column button in the Edit page. They did say it was easier to use the system as you could just use the Search feature to search for anything, although the results were not good.


---

User 5:
Mark Anthony L. Parducho
University Research 1

Task 1: Y
Task 2: Y
Task 3: Y

Task 4:
Query 1:
- LLM: The system was not using the search db tool whatsoever, despite multiple attempts to change the prompts. Stopped at 2 mins
- Direct search: Y, in 37.77. Results were inexact, not at the top, etc.
- Excel: Y, in 1:11.44. They used the Search function. But the Search function could only accomodate searching in one column, so they also used the filter function.

Query 2:
- LLM: N, stopped at 2 mins. Same issues with susceptible to downy mildew.
- Direct search: N, stopped at 23.87 s. Same issue
- Excel: Y, in 40.82 s. They used filters.

Query 3:
- LLM: Y, in 2:03. Again the LLM was not using the search db tool. Then eventually it was able to find something but search results were once again mixed.
- Direct search: Y, in 1 min, but only one result (out of 3) was surfaced
- Excel: Y, in 48s.

Their comments: Search is inconsistent, so we still need to finetune it. The benefit of Excel is that we have filters, which we can use to more specifically narrow down the rows.
