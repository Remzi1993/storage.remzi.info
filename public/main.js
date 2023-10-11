const directoryStructure = [
  {
    name: "assets",
    type: "folder",
    children: [
      {
        name: "docs",
        type: "folder",
        children: [
          {
            name: "Curriculum-vitae-R.Cavdar.pdf",
            type: "file-pdf",
            path: "assets/docs/Curriculum-vitae-R.Cavdar.pdf"
          },
          {
            name: "Onderzoeksverslag-van-R.Cavdar-20-01-2023.pdf",
            type: "file-pdf",
            path: "assets/docs/Onderzoeksverslag-van-R.Cavdar-20-01-2023.pdf"
          }
        ]
      },
      {
        name: "images",
        type: "folder",
        children: [
          {
            name: "cover.png",
            type: "file-image",
            path: "assets/images/cover.png"
          },
          {
            name: "logo.png",
            type: "file-image",
            path: "assets/images/logo.png"
          }
        ]
      }
    ]
  }
];

function generateHTML(directory) {
  let html = '';

  if (directory.type === "folder") {
    html += `<li class="list-group-item"><i class="fa-regular fa-${directory.type}"></i> ${directory.name}</li>`;
    if (directory.children && directory.children.length) {
      html += '<li class="list-group-item">';
      html += '<ul class="list-group mb-2">';
      for (let child of directory.children) {
        html += generateHTML(child);
      }
      html += '</ul>';
      html += '</li>';
    }
  } else {
    html += `<li class="list-group-item"><i class="fa-regular fa-${directory.type}"></i> <a href="${directory.path}">${directory.name}</a></li>`;
  }

  return html;
}

function renderDirectories(directories) {
  let html = '<ul class="list-group">';
  for (let dir of directories) {
    html += generateHTML(dir);
  }
  html += '</ul>';
  return html;
}

// Append the generated HTML to a container
document.querySelector('#directory-container').innerHTML = renderDirectories(directoryStructure);