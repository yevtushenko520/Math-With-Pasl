import { Component, OnInit } from '@angular/core';
import { UserProvider } from '../../providers/user/user';

@Component({
  selector: 'app-loader',
  template: `
    <img src='./assets/oval.svg' alt='loader'> 
    <div> {{auth.loader.text}} </div>
    <button *ngIf='auth.loader.buttonText' (click)='auth.loader.buttonHandler()'> {{auth.loader.buttonText}} </button>
  `,
  styles: [
    `div {
      color: #fff;          margin: 4vw 0;      font-size: 4vw;     text-align: center;
    }
    img {
      width: 60px;      margin: 20px 52px;
    }
    button {
      border: none;      background: #06bcd4;      color: #fff;      padding: 13px 33px;      font-size: 15px;
      font-weight: bold;      text-transform: uppercase;      margin-bottom: 17px;      border-radius: 6px;
      cursor: pointer;      outline: none;
    }
    button:active, button:focus { outline: none }
    `
  ]
})
export class LoaderComponent implements OnInit {
  constructor(public auth: UserProvider) {}

  ngOnInit() {}
}
