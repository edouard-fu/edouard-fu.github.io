const cheerio = require("cheerio");
const unirest = require("unirest");
const ejs = require('ejs');
const fs = require('fs');


// Scrape Google Scholar for aggregate info (e.g. h-index)
const getAuthorProfileData = async () => {
  try {
    const url = "https://scholar.google.nl/citations?user=zqb-X38AAAAJ&hl";
    const response = await unirest
      .get(url)
      .headers({
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
      });

    let $ = cheerio.load(response.body);
    let author_results = {};

    author_results.name = $("#gsc_prf_in").text();
    author_results.position = $("#gsc_prf_inw+ .gsc_prf_il").text();
    author_results.email = $("#gsc_prf_ivh").text();
    author_results.departments = $("#gsc_prf_int").text();

    let cited_by = {};
    cited_by.table = [];
    cited_by.table[0] = {};
    cited_by.table[0].citations = {};
    cited_by.table[0].citations.all = $("tr:nth-child(1) .gsc_rsb_sc1+ .gsc_rsb_std").text();
    cited_by.table[1] = {};
    cited_by.table[1].h_index = {};
    cited_by.table[1].h_index.all = $("tr:nth-child(2) .gsc_rsb_sc1+ .gsc_rsb_std").text();
    cited_by.table[2] = {};
    cited_by.table[2].i_index = {};
    cited_by.table[2].i_index.all = $("tr~ tr+ tr .gsc_rsb_sc1+ .gsc_rsb_std").text();

    console.log(author_results);
    console.log(cited_by.table);
  } catch (e) {
    console.log(e);
  }

  let citation_info = {};
  citation_info.citation_sum = cited_by.table[0].citations.all
  citation_info.h_index = cited_by.table[1].h_index.all
  citation_info.i_index = cited_by.table[2].i_index.all
  return citation_info
};

citation_info = getAuthorProfileData();



// Scrape pubmed for all publication info
var HTMLpublication = '<tr><td>%authors%</td><td>%title%</td><td><i>%journal%</i></td><td>%date%</td><td><a href="%data%" target="_blank">%PMID%</a></td></tr>';

var publications, idStringList;
var pubmedSearchAPI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?";
var pubmedSummaryAPI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?";
var database = "db=pubmed";
var returnmode = "&retmode=json";
var returnmax = "&retmax=500";
var searchterm = "&term=Fu, EL [Author] OR 37397081";
var returntype = "&rettype=abstract";
var idURL = pubmedSearchAPI + database + returnmode + returnmax + searchterm;
console.log(idURL);

var getPubmed = function(url) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('get', url, true);
        xhr.responseType = 'json';
        xhr.onload = function() {
            var status = xhr.status;
            if (status == 200) {
                resolve(xhr.response);
            } else {
                reject(status);
            }
        };
        xhr.send();
    });
};

function scrapePubmed() {
  var scrape_results = {}
    getPubmed(idURL).then(function(data) {
        var idList = data.esearchresult.idlist;
        idStringList = idList.toString();
        idStringList = '&id=' + idStringList;
        summaryURL = pubmedSummaryAPI + database + returnmode + returntype + idStringList;
        getPubmed(summaryURL).then(function(summary) {
            scrape_results = formatReferences(summary);
        }, function(status) {
            publications = 'Something went wrong getting the ids.';
        });
    }, function(status) {
        publications = 'Something went wrong getting the ids.';
    });

  return scrape_results
}

function formatReferences(summary) {
    var publicationList = '';
    var first_authorships = 0;
    var last_authorships = 0;
    var number_of_papers = 0;
    for (var refs in summary.result) {
        if (refs !== 'uids') {
            var authors = '';
            var publication = '';
            var authorCount = summary.result[refs].authors.length;
            var i = 0;
            while (i < authorCount - 1) {
                var authorName = summary.result[refs].authors[i].name;
                if (authorName === 'Fu E') {
                    authorName = 'Fu EL';
                }
                if (authorName === 'Fu EL') {
                    authorName = '<b>' + authorName + '</b>';
                    if (i === 0) {
                        first_authorships++;
                    }
                }
                authors += authorName + ', ';
                i++;
            }
            var lastAuthor = summary.result[refs].lastauthor;
            if (lastAuthor === 'Fu EL') {
                lastAuthor = '<b>' + lastAuthor + '</b>';
                last_authorships++;
            }
            authors += lastAuthor;
            publication = HTMLpublication.replace('%data%', 'http://www.ncbi.nlm.nih.gov/pubmed/' + refs);
            publication = publication.replace('%authors%', authors);
            publication = publication.replace('%title%', summary.result[refs].title);
            publication = publication.replace('%journal%', summary.result[refs].source);
            publication = publication.replace('%PMID%', summary.result[refs].uid);
            if (summary.result[refs].volume !== '') {
                publication = publication.replace('%volume%', ' ' + summary.result[refs].volume);
                publication = publication.replace('%issue%', '(' + summary.result[refs].issue + ')');
                publication = publication.replace('%pages%', ': ' + summary.result[refs].pages + '. ');
                var date = summary.result[refs].pubdate.slice(0, 4);
                publication = publication.replace('%date%', date + '');
            } else {
                publication = publication.replace('%volume%', ' In Press');
                publication = publication.replace('%issue%', '.');
                publication = publication.replace('%pages%', '');
                publication = publication.replace('%date%', '');
            }
            publicationList = publication + publicationList;
            number_of_papers++;
        }
    }

    return { publicationList, number_of_papers, first_authorships, last_authorships };
}

let {publicationList, number_of_papers, first_authorships, last_authorships} = scrapePubmed();

// Combine info on author stats from pubmed and google scholar into 1 variable
let authorStats =  '<b>Number of papers:</b> %number_of_papers% <br>' +
                    '<b>Number of first authorships:</b> %first_authorships%<br>' +
                    '<b>Number of last authorships:</b> %last_authorships% <br>' +
                    '<b>Total number of citations:</b> %citation-sum% <br>' +
                    '<b>H-index:</b> %h-index% <br>';

authorStats = authorStats.replace('%number_of_papers%', number_of_papers)
authorStats = authorStats.replace('%first_authorships%', first_authorships)
authorStats = authorStats.replace('%last_authorships%', last_authorships)
authorStats = authorStats.replace('%citation-sum%', citation_info.citation_sum)
authorStats = authorStats.replace('%h-index%', citation_info.h_index)

// Render info into html template
const templateFiles = ['docs/index.html', 'docs/pages/cv.html', 'docs/pages/network.html', 'docs/pages/publications.html', 'docs/pages/talks.html', 'docs/pages/team.html'];

// Loop through each template file
templateFiles.forEach((filePath) => {
    // Read the template file
    const template = fs.readFileSync(filePath, 'utf-8');

    // Render the HTML with the variables
    const renderedHtml = ejs.render(template, { authorStats, publicationList });

    // Write the rendered HTML to a file
    fs.writeFileSync(filePath, renderedHtml);

    console.log(`Rendered and saved: ${filePath}`);
});