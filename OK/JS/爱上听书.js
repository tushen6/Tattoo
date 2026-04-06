var rule = {
    title:'爱上你听书网',
    host:'https://www.230ts.net',
    url:'/sort/fyclass/fypage.html',
    searchUrl:'/search.html?searchtype=name&searchword=**&page=fypage',
    searchable:2,
    quickSearch:0,
    headers:{
        'User-Agent':'PC_UA'
    },
    timeout:5000,
    class_parse: '.nav-ol&&li:gt(0):lt(6);a&&Text;a&&href;.*/(\\w+).html',
    play_parse:true,
    lazy:'js:input=input.replace("www","wap")',
    limit:6,
    推荐:'#myTab_Content1&&li;.tab-book-title&&Text;*;.tab-book-author&&Text;*',
    一级:'ul.list-works&&li;.list-book-dt--span&&Text;.lazy&&data-original;.book-author:eq(2)&&a&&Text;a&&href',
    二级:{
        title:'.book-cover&&alt;.book-info&&dd--span:eq(1)&&Text',
        img:'.book-cover&&src',
        desc:'.book-info&&dd:eq(4)&&Text;;;.book-info&&dd--span:eq(3)&&Text;.book-info&&dd--span:eq(2)&&Text',
        content:'.book-des&&Text',
        tabs:'.playlist-top&&h2',
        lists: `js:
            let html = request(input);
            let $ = cheerio.load(html);
            let lists = [];
            
            // 获取所有播放列表tab
            $('.playlist-top h2').each(function(i) {
                let listItems = [];
                // 使用原来的选择器格式，但确保获取所有列表
                $('#playlist' + i + ' li').each(function() {
                    let title = $(this).find('a').text().trim();
                    let url = $(this).find('a').attr('href');
                    if (url && title) {
                        listItems.push(title + '$' + url);
                    }
                });
                
                // 如果上面没获取到，尝试其他可能的选择器
                if (listItems.length === 0) {
                    $('.playlist').eq(i).find('li').each(function() {
                        let title = $(this).find('a').text().trim();
                        let url = $(this).find('a').attr('href');
                        if (url && title) {
                            listItems.push(title + '$' + url);
                        }
                    });
                }
                
                if (listItems.length > 0) {
                    lists.push(listItems);
                }
            });
            
            // 如果上面方法没获取到列表，尝试直接获取所有播放列表
            if (lists.length === 0) {
                $('.playlist').each(function(i) {
                    let listItems = [];
                    $(this).find('li').each(function() {
                        let title = $(this).find('a').text().trim();
                        let url = $(this).find('a').attr('href');
                        if (url && title) {
                            listItems.push(title + '$' + url);
                        }
                    });
                    if (listItems.length > 0) {
                        lists.push(listItems);
                    }
                });
            }
            
            // 最后尝试获取所有以playlist开头的ID的列表
            if (lists.length === 0) {
                $('[id^="playlist"]').each(function(i) {
                    let listItems = [];
                    $(this).find('li').each(function() {
                        let title = $(this).find('a').text().trim();
                        let url = $(this).find('a').attr('href');
                        if (url && title) {
                            listItems.push(title + '$' + url);
                        }
                    });
                    if (listItems.length > 0) {
                        lists.push(listItems);
                    }
                });
            }
            
            lists;
        `,
    },
    搜索:'*',
}