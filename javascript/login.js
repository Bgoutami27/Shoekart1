function text() {
    const Element = document.querySelector('.input'); 
    const input = Element.value.trim(); 
    console.log(input);

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; 
    const phoneRegex = /^\d{10}$/;
    
    let message = document.querySelector('.message');
    if (!message) {
        message = document.createElement('p');
        message.className = 'message';
        document.querySelector('.login1').appendChild(message); 
    }

    if (emailRegex.test(input) || phoneRegex.test(input)) {
        message.textContent = "";
        message.style.color = "";
        return true; 
    } else {
        message.textContent = "Invalid Email or Phone Number!";
        message.style.color = "red"; 
        return false;
    }
}

function text1() {
    const Element1 = document.querySelector('.input1'); 
    const Element = document.querySelector('.input'); 
    const name1 = Element1.value.trim(); 
    const name = Element.value.trim(); 
    console.log(name1);
    console.log(name)

    if (name1.length === 0 || name.length === 0) {
    
        alert("Password and email or phone no .... \nis required!");
        return false;
    }
    return true;
}

function click() {
    window.location.assign("http://127.0.0.1:5500/shoe.html"); 
}

function click1() {
    const loginButton = document.querySelector('.Login'); 
    const loged = loginButton.innerHTML.trim(); 
    removeEventListener.loginButton;
}


function handleContinue() {
    setTimeout(() => {
        const isInputValid = text();  
        const isNameValid = text1();  

        if (isInputValid && isNameValid) {
            click();
            click1();  
        }
    }, 1500);  
}


window.text = text;
window.text1 = text1;
window.handleContinue = handleContinue;
window.click1 = click1;

