var HTMLpublication = '<tr><td>%authors%</td><td>%title%</td><td><i>%journal%</i></td><td>%date%</td><td><a href="%data%" target="_blank">%PMID%</a></td></tr>';

var publications, idStringList;
var pubmedSearchAPI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?";
var pubmedSummaryAPI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?";
var database = "db=pubmed";
var returnmode = "&retmode=json";
var returnmax = "&retmax=500";
var searchterm = "&term=Kamil Slowikowski[Author]";
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

const log = document.getElementById('pubmed_scraper').querySelector('tbody');
const log_stats = document.getElementById('publication-stats');

updateValue();

function updateValue() {
    // Show loading message
    log.innerHTML = '<tr><td colspan="8">Generating citations, this may take a few seconds... <br><br> But please refresh the page if it takes too long</td></tr>';

    searchterm = '&term=Fu, EL [Author] OR 37397081';
    idURL = pubmedSearchAPI + database + returnmode + returnmax + searchterm;
    console.log(idURL);

    getPubmed(idURL).then(function(data) {
        var idList = data.esearchresult.idlist;
        idStringList = idList.toString();
        idStringList = '&id=' + idStringList;
        summaryURL = pubmedSummaryAPI + database + returnmode + returntype + idStringList;
        getPubmed(summaryURL).then(function(summary) {
            publications = formatReferences(summary);
            console.log(publications);
            log.innerHTML = publications;
        }, function(status) {
            publications = 'Something went wrong getting the ids.';
        });
    }, function(status) {
        publications = 'Something went wrong getting the ids.';
    });
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
    var stats = '<b>Number of papers:</b> %number_of_papers% <br><b>Number of first authorships:</b> %first_authorships%<br><b>Number of last authorships:</b> %last_authorships% <br>';
    stats = stats.replace('%number_of_papers%', number_of_papers)
    stats = stats.replace('%first_authorships%', first_authorships)
    stats = stats.replace('%last_authorships%', last_authorships)
    log_stats.innerHTML = stats


    return publicationList;
}