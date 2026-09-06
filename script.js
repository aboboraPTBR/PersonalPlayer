const audio =
    document.getElementById("audio");

const fileInput =
    document.getElementById("fileInput");

const addButton =
    document.getElementById("addButton");

const songsContainer =
    document.getElementById("songs");

const searchInput =
    document.getElementById("search");

const dropZone =
    document.getElementById("dropZone");

const playButton =
    document.getElementById("playButton");

const previousButton =
    document.getElementById("previousButton");

const nextButton =
    document.getElementById("nextButton");

const shuffleButton =
    document.getElementById("shuffleButton");

const repeatButton =
    document.getElementById("repeatButton");

const progress =
    document.getElementById("progress");

const volumeSlider =
    document.getElementById("volumeSlider");

const volumeIcon =
    document.getElementById("volumeIcon");

const currentTitle =
    document.getElementById("currentTitle");

const currentTime =
    document.getElementById("currentTime");

const durationElement =
    document.getElementById("duration");

const songCount =
    document.getElementById("songCount");


/*
====================================================
                    CONFIGURAÇÃO
====================================================
*/


let songs = [];

let currentIndex = -1;

let shuffle = false;


/*
repeatMode:

0 = repetir playlist
1 = repetir música
2 = não repetir
*/

let repeatMode = 0;


/*
====================================================
                  INDEXEDDB
====================================================
*/

const DB_NAME =
    "MeuPlayerDatabase";

const DB_VERSION = 1;

const STORE_NAME =
    "songs";

let db;


/* ABRIR BANCO */

function openDatabase() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );


            request.onupgradeneeded =
                event => {

                    const database =
                        event.target.result;


                    if (
                        !database.objectStoreNames
                            .contains(STORE_NAME)
                    ) {

                        database.createObjectStore(
                            STORE_NAME,
                            {
                                keyPath: "id"
                            }
                        );

                    }

                };


            request.onsuccess =
                event => {

                    db =
                        event.target.result;

                    resolve(db);

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* PEGAR TODAS AS MÚSICAS */

function getAllSongs() {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            const request =
                store.getAll();


            request.onsuccess =
                () => {

                    resolve(
                        request.result
                    );

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* SALVAR UMA MÚSICA */

function saveSong(song) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            transaction
                .objectStore(STORE_NAME)
                .put(song);


            transaction.oncomplete =
                () => resolve();


            transaction.onerror =
                () => reject(
                    transaction.error
                );

        }
    );

}


/* APAGAR UMA MÚSICA */

function deleteSongFromDB(id) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            transaction
                .objectStore(STORE_NAME)
                .delete(id);


            transaction.oncomplete =
                () => resolve();


            transaction.onerror =
                () => reject(
                    transaction.error
                );

        }
    );

}


/*
====================================================
                   UTILIDADES
====================================================
*/


function formatTime(seconds) {

    if (
        !Number.isFinite(seconds)
    ) {

        return "0:00";

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    const secs =
        Math.floor(
            seconds % 60
        )
        .toString()
        .padStart(2, "0");


    return `${minutes}:${secs}`;
}


function escapeHTML(text) {

    const div =
        document.createElement("div");


    div.textContent =
        text;


    return div.innerHTML;
}


/*
====================================================
                  RENDER PLAYLIST
====================================================
*/

function renderPlaylist() {

    const query =
        searchInput.value
            .trim()
            .toLowerCase();


    songsContainer.innerHTML = "";


    const filteredSongs =
        songs.filter(
            song =>
                song.name
                    .toLowerCase()
                    .includes(query)
        );


    if (
        filteredSongs.length === 0
    ) {

        songsContainer.innerHTML =
            `
            <div class="empty">
                ${
                    songs.length === 0
                        ? "Sua biblioteca está vazia 👀"
                        : "Nenhuma música encontrada"
                }
            </div>
            `;

        updateSongCount();

        return;

    }


    filteredSongs.forEach(
        (song, filteredIndex) => {

            const index =
                songs.findIndex(
                    item =>
                        item.id === song.id
                );


            const element =
                document.createElement("div");


            element.className =
                "song";


            if (
                index === currentIndex
            ) {

                element.classList.add(
                    "active"
                );

            }


            element.innerHTML =
                `
                <span class="song-index">
                    ${
                        index === currentIndex
                            ? "♫"
                            : index + 1
                    }
                </span>

                <div class="song-main">

                    <div class="song-name">
                        ${escapeHTML(song.name)}
                    </div>

                    <div class="song-meta">
                        ${formatTime(song.duration)}
                    </div>

                </div>

                <div class="song-actions">

                    <button
                        class="delete-button"
                        title="Excluir"
                    >
                        🗑
                    </button>

                </div>
                `;


            /*
            Clicar na música
            */

            element.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            ".delete-button"
                        )
                    ) {

                        return;

                    }


                    playSong(index);

                }
            );


            /*
            Botão apagar
            */

            element
                .querySelector(
                    ".delete-button"
                )
                .addEventListener(
                    "click",
                    async event => {

                        event.stopPropagation();

                        await removeSong(
                            index
                        );

                    }
                );


            songsContainer.appendChild(
                element
            );

        }
    );


    updateSongCount();
}


/* CONTAGEM */

function updateSongCount() {

    songCount.textContent =
        `${songs.length} ${
            songs.length === 1
                ? "música"
                : "músicas"
        }`;
}


/*
====================================================
                   REPRODUÇÃO
====================================================
*/


async function playSong(index) {

    if (!songs[index]) {

        return;

    }


    currentIndex =
        index;


    const song =
        songs[index];


    /*
    Object URL temporário para tocar
    o Blob salvo no IndexedDB
    */

    if (
        song.objectUrl
    ) {

        URL.revokeObjectURL(
            song.objectUrl
        );

    }


    song.objectUrl =
        URL.createObjectURL(
            song.blob
        );


    audio.src =
        song.objectUrl;


    currentTitle.textContent =
        song.name;


    renderPlaylist();


    try {

        await audio.play();

    } catch (error) {

        console.warn(
            "Não foi possível iniciar automaticamente:",
            error
        );

    }


    updatePlayButton();

}


/*
====================================================
                    PLAY/PAUSE
====================================================
*/

playButton.addEventListener(
    "click",
    async () => {

        if (
            songs.length === 0
        ) {

            return;

        }


        if (
            currentIndex === -1
        ) {

            await playSong(0);

            return;

        }


        if (
            audio.paused
        ) {

            await audio.play();

        } else {

            audio.pause();

        }


        updatePlayButton();

    }
);


function updatePlayButton() {

    playButton.textContent =
        audio.paused
            ? "▶"
            : "Ⅱ";
}


/*
====================================================
                    ANTERIOR
====================================================
*/

previousButton.addEventListener(
    "click",
    () => {

        if (
            songs.length === 0
        ) {

            return;

        }


        /*
        Se a música passou mais de
        3 segundos, volta pro começo
        */

        if (
            audio.currentTime > 3
        ) {

            audio.currentTime = 0;

            return;

        }


        playSong(
            currentIndex <= 0
                ? songs.length - 1
                : currentIndex - 1
        );

    }
);


/*
====================================================
                     PRÓXIMA
====================================================
*/

nextButton.addEventListener(
    "click",
    () => {

        playNext();

    }
);


function playNext() {

    if (
        songs.length === 0
    ) {

        return;

    }


    let nextIndex;


    if (shuffle) {

        nextIndex =
            Math.floor(
                Math.random() * songs.length
            );


        if (
            songs.length > 1 &&
            nextIndex === currentIndex
        ) {

            nextIndex =
                (nextIndex + 1)
                % songs.length;

        }

    } else {

        nextIndex =
            (currentIndex + 1)
            % songs.length;

    }


    playSong(nextIndex);
}


/*
====================================================
                   ALEATÓRIO
====================================================
*/

shuffleButton.addEventListener(
    "click",
    () => {

        shuffle =
            !shuffle;


        shuffleButton.classList.toggle(
            "active",
            shuffle
        );

    }
);


/*
====================================================
                    REPETIÇÃO
====================================================
*/

repeatButton.addEventListener(
    "click",
    () => {

        repeatMode =
            (repeatMode + 1) % 3;


        /*
        0 = playlist
        1 = música
        2 = nenhum
        */

        updateRepeatButton();

    }
);


function updateRepeatButton() {

    repeatButton.classList.remove(
        "active"
    );


    if (
        repeatMode === 0
    ) {

        repeatButton.textContent =
            "🔁";

        repeatButton.classList.add(
            "active"
        );

    }


    if (
        repeatMode === 1
    ) {

        repeatButton.textContent =
            "🔂";

        repeatButton.classList.add(
            "active"
        );

    }


    if (
        repeatMode === 2
    ) {

        repeatButton.textContent =
            "➡";

    }

}


/*
====================================================
                FIM DA MÚSICA
====================================================
*/

audio.addEventListener(
    "ended",
    () => {

        if (
            repeatMode === 1
        ) {

            audio.currentTime = 0;

            audio.play();

            return;

        }


        if (
            repeatMode === 0
        ) {

            playNext();

        }

    }
);


/*
====================================================
                   PROGRESSO
====================================================
*/

audio.addEventListener(
    "timeupdate",
    () => {

        currentTime.textContent =
            formatTime(
                audio.currentTime
            );


        if (
            audio.duration
        ) {

            progress.value =
                (
                    audio.currentTime /
                    audio.duration
                ) * 100;

        }

    }
);


audio.addEventListener(
    "loadedmetadata",
    () => {

        durationElement.textContent =
            formatTime(
                audio.duration
            );

    }
);


progress.addEventListener(
    "input",
    () => {

        if (
            !audio.duration
        ) {

            return;

        }


        audio.currentTime =
            (
                progress.value / 100
            )
            * audio.duration;

    }
);


/*
====================================================
                    VOLUME
====================================================
*/

volumeSlider.addEventListener(
    "input",
    () => {

        setVolume(
            Number(volumeSlider.value)
        );

    }
);


function setVolume(value) {

    value =
        Math.max(
            0,
            Math.min(1, value)
        );


    audio.volume =
        value;


    volumeSlider.value =
        value;


    localStorage.setItem(
        "playerVolume",
        value
    );


    if (
        value === 0
    ) {

        volumeIcon.textContent =
            "🔇";

    } else if (
        value < 0.5
    ) {

        volumeIcon.textContent =
            "🔉";

    } else {

        volumeIcon.textContent =
            "🔊";

    }

}


/*
====================================================
              ADICIONAR MÚSICAS
====================================================
*/

addButton.addEventListener(
    "click",
    () => {

        fileInput.click();

    }
);


fileInput.addEventListener(
    "change",
    async event => {

        await importFiles(
            Array.from(
                event.target.files
            )
        );


        fileInput.value = "";

    }
);


async function importFiles(files) {

    const audioFiles =
        files.filter(
            file =>
                file.type.startsWith(
                    "audio/"
                )
        );


    for (
        const file of audioFiles
    ) {

        const duration =
            await getAudioDuration(
                file
            );


        const song = {

            id:
                crypto.randomUUID(),

            name:
                file.name
                    .replace(
                        /\.[^/.]+$/,
                        ""
                    ),

            blob:
                file,

            duration:

                duration

        };


        await saveSong(song);


        songs.push(song);

    }


    renderPlaylist();


    /*
    Se ainda não havia música,
    toca a primeira
    */

    if (
        currentIndex === -1 &&
        songs.length > 0
    ) {

        playSong(0);

    }

}


/*
====================================================
             PEGAR DURAÇÃO DO ÁUDIO
====================================================
*/

function getAudioDuration(file) {

    return new Promise(
        resolve => {

            const url =
                URL.createObjectURL(
                    file
                );


            const tempAudio =
                new Audio();


            tempAudio.preload =
                "metadata";


            tempAudio.onloadedmetadata =
                () => {

                    const duration =
                        tempAudio.duration;


                    URL.revokeObjectURL(
                        url
                    );


                    resolve(
                        Number.isFinite(
                            duration
                        )
                            ? duration
                            : 0
                    );

                };


            tempAudio.onerror =
                () => {

                    URL.revokeObjectURL(
                        url
                    );


                    resolve(0);

                };


            tempAudio.src =
                url;

        }
    );

}


/*
====================================================
                  EXCLUIR MÚSICA
====================================================
*/

async function removeSong(index) {

    const song =
        songs[index];


    if (!song) {

        return;

    }


    const confirmed =
        confirm(
            `Excluir "${song.name}" da biblioteca?`
        );


    if (!confirmed) {

        return;

    }


    /*
    Se a música excluída
    estiver tocando
    */

    if (
        index === currentIndex
    ) {

        audio.pause();

        audio.removeAttribute(
            "src"
        );

        audio.load();

        currentIndex = -1;

        currentTitle.textContent =
            "Nenhuma música";

        currentTime.textContent =
            "0:00";

        durationElement.textContent =
            "0:00";

        progress.value =
            0;

    }


    await deleteSongFromDB(
        song.id
    );


    if (
        song.objectUrl
    ) {

        URL.revokeObjectURL(
            song.objectUrl
        );

    }


    songs.splice(
        index,
        1
    );


    /*
    Ajustar índice
    */

    if (
        currentIndex > index
    ) {

        currentIndex--;

    }


    renderPlaylist();

    updatePlayButton();

}


/*
====================================================
                  DRAG & DROP
====================================================
*/

[
    "dragenter",
    "dragover"
].forEach(
    eventName => {

        dropZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                dropZone.classList.add(
                    "dragging"
                );

            }
        );

    }
);


[
    "dragleave",
    "drop"
].forEach(
    eventName => {

        dropZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                dropZone.classList.remove(
                    "dragging"
                );

            }
        );

    }
);


dropZone.addEventListener(
    "drop",
    async event => {

        const files =
            Array.from(
                event.dataTransfer.files
            );


        await importFiles(
            files
        );

    }
);


/*
====================================================
                     PESQUISA
====================================================
*/

searchInput.addEventListener(
    "input",
    () => {

        renderPlaylist();

    }
);


/*
====================================================
                ATALHOS DO TECLADO
====================================================
*/

document.addEventListener(
    "keydown",
    event => {

        /*
        Não roubar teclas quando
        o usuário estiver pesquisando
        */

        if (
            document.activeElement ===
            searchInput
        ) {

            return;

        }


        /*
        SPACE
        */

        if (
            event.code === "Space"
        ) {

            event.preventDefault();

            playButton.click();

        }


        /*
        SETA DIREITA
        */

        if (
            event.code === "ArrowRight"
        ) {

            playNext();

        }


        /*
        SETA ESQUERDA
        */

        if (
            event.code === "ArrowLeft"
        ) {

            previousButton.click();

        }


        /*
        SETA PARA CIMA
        */

        if (
            event.code === "ArrowUp"
        ) {

            event.preventDefault();

            setVolume(
                audio.volume + 0.05
            );

        }


        /*
        SETA PARA BAIXO
        */

        if (
            event.code === "ArrowDown"
        ) {

            event.preventDefault();

            setVolume(
                audio.volume - 0.05
            );

        }

    }
);


/*
====================================================
                  RESTAURAR VOLUME
====================================================
*/

const savedVolume =
    Number(
        localStorage.getItem(
            "playerVolume"
        )
    );


if (
    Number.isFinite(
        savedVolume
    )
) {

    setVolume(
        savedVolume
    );

} else {

    setVolume(0.8);

}


/*
====================================================
                  INICIALIZAÇÃO
====================================================
*/

async function initialize() {

    try {

        await openDatabase();


        songs =
            await getAllSongs();


        renderPlaylist();

        updateRepeatButton();

        updatePlayButton();

    } catch (error) {

        console.error(
            "Erro ao abrir a biblioteca:",
            error
        );


        songsContainer.innerHTML =
            `
            <div class="empty">
                O navegador não conseguiu
                abrir o banco de músicas 💀
            </div>
            `;

    }

}


initialize();